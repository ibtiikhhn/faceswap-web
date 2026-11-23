import { getPool, type DbClient } from '@/server/db';
import { ownerPage } from './owner-services';

export function billingEnvironment(value?: string) {
  return value === 'sandbox' ? 'sandbox' : 'production';
}

export async function ownerInsights(
  days = 7,
  client: DbClient = getPool(),
  now = new Date(),
) {
  const range = days === 30 ? 30 : 7;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - range + 1);
  const [activity, jobs, storage, errors] = await Promise.all([
    client.query<{
      day: string;
      total: number;
      succeeded: number;
      failed: number;
    }>(
      `select substr(cast(created_at as text),1,10) as day,count(*) as total,
       count(*) filter(where state='succeeded') as succeeded,count(*) filter(where state='failed') as failed
       from app.swap_jobs where created_at >= $1 and created_at <= $2 group by substr(cast(created_at as text),1,10) order by day`,
      [start.toISOString(), now.toISOString()],
    ),
    client.query<{ active: number; stale: number; guests: number }>(
      `select
      count(*) filter(where state in ('queued','validating','processing','saving','retry_wait','reconciling')) as active,
      count(*) filter(where state in ('queued','validating','processing','saving','retry_wait','reconciling') and updated_at < $1) as stale,
      count(*) filter(where mode='guest_trial') as guests from app.swap_jobs`,
      [new Date(now.valueOf() - 15 * 60000).toISOString()],
    ),
    client.query<{
      files: number;
      bytes: number;
      pending_delete: number;
    }>(`select count(*) filter(where status='active') as files,
      coalesce(sum(byte_count) filter(where status='active'),0) as bytes,
      count(*) filter(where status='deleted' and object_deleted_at is null) as pending_delete from app.assets`),
    client.query<{ error_code: string; count: number }>(
      `select coalesce(error_code,'unknown') as error_code,count(*) as count
      from app.swap_jobs where state='failed' and created_at >= $1 and created_at <= $2 group by error_code order by count(*) desc limit 5`,
      [start.toISOString(), now.toISOString()],
    ),
  ]);
  const daily = Array.from({ length: range }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const day = date.toISOString().slice(0, 10);
    const row = activity.rows.find((r) => r.day === day);
    return {
      day,
      total: Number(row?.total || 0),
      succeeded: Number(row?.succeeded || 0),
      failed: Number(row?.failed || 0),
    };
  });
  return {
    daily,
    jobs: jobs.rows[0],
    storage: storage.rows[0],
    errors: errors.rows,
    range,
  };
}

export async function ownerBilling(
  options: {
    environment?: string;
    userId?: string;
    page?: number;
    search?: string;
    attention?: boolean;
  } = {},
  client: DbClient = getPool(),
) {
  const environment = billingEnvironment(options.environment),
    page = ownerPage(options.page);
  const params = [
    environment,
    options.userId || '',
    `%${(options.search || '').trim().toLowerCase().slice(0, 200)}%`,
    Boolean(options.attention),
  ];
  const filter = `where p.environment=$1 and ($2='' or p.user_id=nullif($2,'')::uuid)
    and (lower(u.email) like $3 or lower(p.id) like $3) and (not $4 or p.disputed or p.revoked_credits>0)`;
  const [payments, count, events, checkouts, stats, memberships] =
    await Promise.all([
      client.query<{
        id: string;
        user_id: string;
        email: string;
        code: string | null;
        membership_id: string | null;
        revoked_credits: number;
        disputed: boolean;
        updated_at: string;
        granted: number | null;
      }>(
        `select p.id,p.user_id,u.email,coalesce(c.code,m.code) as code,p.membership_id,p.revoked_credits,p.disputed,p.updated_at,g.original_amount as granted
       from app.whop_payments p join app.users u on u.id=p.user_id
       left join app.whop_checkouts c on c.id=p.checkout_id left join app.whop_memberships m on m.id=p.membership_id
       left join app.credit_grants g on g.id=p.grant_id ${filter} order by p.updated_at desc,p.id limit 25 offset $5`,
        [...params, (page - 1) * 25],
      ),
      client.query<{ count: number }>(
        `select count(*) as count from app.whop_payments p join app.users u on u.id=p.user_id ${filter}`,
        params,
      ),
      // Global operational queues are intentionally omitted from customer-scoped billing.
      options.userId
        ? Promise.resolve({ rows: [] })
        : client.query<{
            id: string;
            type: string;
            state: string;
            attempts: number;
            next_attempt_at: string;
            resource_id: string;
          }>(
            `select id,type,state,attempts,next_attempt_at,resource_id from app.whop_event_inbox where environment=$1 and state<>'done' order by attempts desc,created_at limit 30`,
            [environment],
          ),
      client.query<{
        id: string;
        user_id: string;
        email: string;
        code: string;
        state: string;
        created_at: string;
      }>(
        `select c.id,c.user_id,u.email,c.code,c.state,c.created_at from app.whop_checkouts c join app.users u on u.id=c.user_id
       where c.environment=$1 and ($2='' or c.user_id=nullif($2,'')::uuid) and c.state in ('creating','ready','review') order by c.created_at limit 25`,
        params.slice(0, 2),
      ),
      client.query<{
        memberships: number;
        disputes: number;
        webhooks: number;
        exhausted: number;
      }>(
        `select
      (select count(*) from app.whop_memberships where environment=$1 and status in ('active','trialing')) as memberships,
      (select count(*) from app.whop_payments where environment=$1 and disputed) as disputes,
      (select count(*) from app.whop_event_inbox where environment=$1 and state<>'done') as webhooks,
      (select count(*) from app.whop_event_inbox where environment=$1 and state<>'done' and attempts>=30) as exhausted`,
        [environment],
      ),
      client.query<{
        id: string;
        user_id: string;
        email: string;
        code: string;
        status: string;
        period_end: string | null;
        cancel_at_period_end: boolean;
      }>(
        `select m.id,m.user_id,u.email,m.code,m.status,m.period_end,m.cancel_at_period_end from app.whop_memberships m join app.users u on u.id=m.user_id
       where m.environment=$1 and ($2='' or m.user_id=nullif($2,'')::uuid) order by m.updated_at desc limit 50`,
        params.slice(0, 2),
      ),
    ]);
  return {
    environment,
    page,
    payments: payments.rows,
    total: Number(count.rows[0].count),
    events: events.rows,
    checkouts: checkouts.rows,
    stats: stats.rows[0],
    memberships: memberships.rows,
  };
}
