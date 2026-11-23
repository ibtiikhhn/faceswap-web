import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import {
  listOwnerSaasOverview,
  listOwnerOperations,
  listOwnerGenerations,
  getOwnerCustomerActivity,
  ownerPage,
  type OwnerJob,
} from '@/cms/owner-services';
import { assertCmsOwner } from '@/cms/owner-media';
import OwnerActions from './OwnerActions';
import { ownerInsights, ownerBilling } from '@/cms/owner-insights';
import { OperationsView, BillingView } from './OperationsViews';
import GenerationPhoto from './GenerationPhoto';
const number = (v: number) => new Intl.NumberFormat('en').format(v);
function date(v: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.valueOf())
    ? '—'
    : new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(d) + ' UTC';
}
function href(values: Record<string, string | number>) {
  return (
    '/admin/saas?' +
    new URLSearchParams(
      Object.entries(values).map(([k, v]) => [k, String(v)]),
    ).toString()
  );
}
function Badge({ state }: { state: string }) {
  return (
    <span className={`cms-saas__badge cms-saas__badge--${state}`}>
      {state.replaceAll('_', ' ')}
    </span>
  );
}
function Pager({
  page,
  total,
  size,
  values,
  keyName = 'page',
}: {
  page: number;
  total: number;
  size: number;
  values: Record<string, string | number>;
  keyName?: string;
}) {
  return (
    <nav className="cms-saas__pager" aria-label="Pagination">
      <span>
        {number(total)} records · Page {page} of{' '}
        {Math.max(1, Math.ceil(total / size))}
      </span>
      <div>
        {page > 1 && (
          <Link
            prefetch={false}
            href={href({ ...values, [keyName]: page - 1 })}
          >
            ← Previous
          </Link>
        )}
        {page * size < total && (
          <Link
            prefetch={false}
            href={href({ ...values, [keyName]: page + 1 })}
          >
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}
function Job({ job }: { job: OwnerJob }) {
  const available = (status: string | null, expiry: string | null) =>
    status === 'active' && (!expiry || new Date(expiry).valueOf() > Date.now());
  return (
    <article className="cms-saas__job" id={`job-${job.id}`}>
      <header>
        <div>
          <p className="cms-saas__eyebrow">{job.email || 'Guest generation'}</p>
          <h3>{date(job.created_at)}</h3>
          <code>{job.id}</code>
        </div>
        <Badge state={job.state} />
      </header>
      <div className="cms-saas__photos">
        <GenerationPhoto
          id={job.source_asset_id}
          label="01 · Source face"
          available={available(job.source_status, job.source_expires)}
        />
        <GenerationPhoto
          id={job.target_asset_id}
          label="02 · Target photo"
          available={available(job.target_status, job.target_expires)}
        />
        <GenerationPhoto
          id={job.result_asset_id}
          label="03 · Generated result"
          available={available(job.result_status, job.result_expires)}
        />
      </div>
      <footer>
        <span>
          {job.provider_mode === 'mock' ? 'Mock provider' : 'Live provider'}
        </span>
        <span>
          {job.mode === 'guest_trial'
            ? 'Guest trial'
            : `${job.credit_amount ?? 0} credit(s) · ${job.credit_state ?? 'No reservation'}`}
        </span>
        <span>Completed: {date(job.finished_at)}</span>
        {job.user_id && (
          <Link prefetch={false} href={href({ customer: job.user_id })}>
            View customer →
          </Link>
        )}
      </footer>
      <details className="cms-saas__chart-data">
        <summary>Technical details</summary>
        <div className="cms-saas__diagnostics">
          <p>
            Provider request:{' '}
            <code>{job.provider_request_id || 'Not recorded'}</code>
          </p>
          <p>Last update: {date(job.updated_at)}</p>
        </div>
      </details>
      {job.error_message && (
        <p className="cms-saas__error">
          {job.error_code ? `${job.error_code}: ` : ''}
          {job.error_message}
        </p>
      )}
    </article>
  );
}
export default async function SaaSOverview({
  searchParams,
  initPageResult,
}: AdminViewServerProps) {
  const owner = initPageResult.req.user;
  if (!owner) redirect('/admin/login');
  assertCmsOwner(owner);
  const value = (key: string) =>
    typeof searchParams?.[key] === 'string' ? String(searchParams[key]) : '';
  const customer = value('customer');
  const validCustomer = !customer || /^[0-9a-f-]{36}$/i.test(customer);
  const tab = ['customers', 'generations', 'billing', 'audit'].includes(
    value('tab'),
  )
    ? value('tab')
    : 'overview';
  const q = value('q').slice(0, 200);
  const state = value('state');
  const page = ownerPage(value('page'));
  const jobPage = ownerPage(value('jobPage'));
  if (!validCustomer)
    return (
      <main className="cms-saas">
        <h1>Invalid customer link</h1>
        <Link prefetch={false} href="/admin/saas">
          Return to customers
        </Link>
      </main>
    );
  const [overview, operations, generations, activity, insights, billing] =
    await Promise.all([
      listOwnerSaasOverview(undefined, {
        search: customer ? '' : q,
        page: customer ? 1 : page,
        customerId: customer,
        access: customer ? '' : value('access'),
      }),
      listOwnerOperations(),
      customer || tab === 'generations'
        ? listOwnerGenerations({
            userId: customer,
            page: jobPage,
            state,
            search: value('jobSearch'),
            stale: value('stale') === '1',
          })
        : Promise.resolve(null),
      customer ? getOwnerCustomerActivity(customer) : Promise.resolve(null),
      !customer && tab === 'overview'
        ? ownerInsights(Number(value('days')))
        : Promise.resolve(null),
      customer || tab === 'billing'
        ? ownerBilling({
            userId: customer,
            environment: value('environment'),
            page: ownerPage(value('billingPage')),
            search: value('billingSearch'),
            attention: value('attention') === '1',
          })
        : Promise.resolve(null),
    ]);
  const selected = customer ? overview.users[0] : null;
  if (customer && !selected)
    return (
      <main className="cms-saas">
        <h1>Customer not found</h1>
        <Link prefetch={false} href="/admin/saas">
          Return to customers
        </Link>
      </main>
    );
  const totals = overview.totals;
  return (
    <main className="cms-saas">
      <header className="cms-saas__header">
        <div>
          <p className="cms-saas__eyebrow">SWAPTHISFACE / CONTROL ROOM</p>
          {selected && (
            <Link
              prefetch={false}
              className="cms-saas__back"
              href="/admin/saas?tab=customers"
            >
              ← All customers
            </Link>
          )}
          <h1>
            {selected
              ? selected.name || 'Customer details'
              : 'Your studio, at a glance.'}
          </h1>
          <p className="cms-saas__subtitle">
            {selected
              ? selected.email
              : 'Customers, generations and billing activity in one place.'}
          </p>
        </div>
        <span className="cms-saas__owner">Owner access · {owner.email}</span>
      </header>
      {value('updated') && (
        <p className="cms-saas__notice" role="status">
          {value('updated') === 'credits'
            ? 'Credits granted and recorded in the ledger.'
            : 'Account access updated and audited.'}
        </p>
      )}
      {value('error') && (
        <p className="cms-saas__error" role="alert">
          {value('error')}
        </p>
      )}
      <section
        className="cms-saas__metrics"
        aria-label={
          selected ? 'Customer totals' : 'All-time totals including guests'
        }
      >
        {(selected
          ? [
              [
                'Available credits',
                selected.creditsAvailable,
                `${selected.creditsReserved} reserved`,
              ],
              ['Generations', selected.swapsTotal, 'All-time customer jobs'],
              ['Successful', selected.swapsSucceeded, 'Completed results'],
              ['Failed', selected.swapsFailed, 'Jobs requiring attention'],
            ]
          : [
              ['Customers', totals.users, `${totals.suspendedUsers} suspended`],
              ['Generations', totals.swapsTotal, 'All-time, including guests'],
              ['Successful', totals.swapsSucceeded, 'Completed results'],
              ['Failed', totals.swapsFailed, 'Jobs requiring attention'],
            ]
        ).map(([label, count, hint]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{number(Number(count))}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </section>
      {selected && activity ? (
        <>
          <section className="cms-saas__panel">
            <div className="cms-saas__panel-head">
              <div>
                <h2>Account & billing</h2>
                <p>Joined {date(selected.createdAt)}</p>
              </div>
              <Badge state={selected.suspendedAt ? 'suspended' : 'active'} />
            </div>
            <div className="cms-saas__account-grid">
              <div>
                <p className="cms-saas__eyebrow">CUSTOMER ID</p>
                <code>{selected.id}</code>
                <h3>Subscriptions</h3>
                {activity.subscriptions.map((s) => (
                  <p key={s.id}>
                    <strong>{s.plan_code || 'Unassigned plan'}</strong> ·{' '}
                    {s.status}
                    <br />
                    Paid through {date(s.paid_current_period_end)}
                    {s.cancel_at_period_end ? ' · Renewal cancelled' : ''}
                  </p>
                ))}
                {!activity.subscriptions.length && (
                  <p>
                    No subscriptions. Standalone credits may still be available.
                  </p>
                )}
              </div>
              <OwnerActions
                key={selected.id}
                userId={selected.id}
                suspended={Boolean(selected.suspendedAt)}
                auditReady={operations.auditReady}
              />
            </div>
          </section>
        </>
      ) : (
        <nav className="cms-saas__tabs" aria-label="Studio sections">
          {[
            ['overview', 'Overview'],
            ['customers', 'Customers'],
            ['generations', 'Generations'],
            ['billing', 'Billing & webhooks'],
            ['audit', 'Owner activity'],
          ].map(([key, label]) => (
            <Link
              prefetch={false}
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              href={href({ tab: key })}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {insights && <OperationsView data={insights} />}
      {!selected && tab === 'customers' && (
        <section className="cms-saas__panel">
          <div className="cms-saas__panel-head">
            <div>
              <h2>Customers</h2>
              <p>
                Open a customer to inspect their photos, results and credit
                history.
              </p>
            </div>
            <form
              method="get"
              action="/admin/saas"
              className="cms-saas__search"
            >
              <input type="hidden" name="tab" value="customers" />
              <label className="cms-saas__sr" htmlFor="customer-search">
                Search customers by email or name
              </label>
              <input
                id="customer-search"
                name="q"
                defaultValue={q}
                placeholder="Search email or name…"
              />
              <select
                name="access"
                aria-label="Customer access"
                defaultValue={value('access')}
              >
                <option value="">All customers</option>
                <option value="active">Active access</option>
                <option value="suspended">Suspended</option>
              </select>
              <button type="submit">Search</button>
              {q && (
                <Link prefetch={false} href="/admin/saas?tab=customers">
                  Clear
                </Link>
              )}
            </form>
          </div>
          <div className="cms-saas__table-wrap">
            <table className="cms-saas__table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Access</th>
                  <th>Credits</th>
                  <th>Generations</th>
                  <th>Joined</th>
                  <th>
                    <span className="cms-saas__sr">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link
                        prefetch={false}
                        className="cms-saas__customer"
                        href={href({ customer: u.id })}
                      >
                        <span className="cms-saas__avatar">
                          {(u.name || u.email).slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{u.name || u.email}</strong>
                          <small>{u.email}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Badge state={u.suspendedAt ? 'suspended' : 'active'} />
                    </td>
                    <td>
                      <strong>{number(u.creditsAvailable)}</strong>
                      <small>{u.creditsReserved} reserved</small>
                    </td>
                    <td>
                      <strong>{u.swapsTotal}</strong>
                      <small>
                        {u.swapsSucceeded} successful · {u.swapsFailed} failed
                      </small>
                    </td>
                    <td>{date(u.createdAt)}</td>
                    <td>
                      <Link prefetch={false} href={href({ customer: u.id })}>
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!overview.users.length && (
            <div className="cms-saas__empty">
              {q
                ? 'No customers match this search.'
                : 'Your first customer will appear here.'}
            </div>
          )}
          <Pager
            page={page}
            total={overview.matchedUsers}
            size={25}
            values={{ q, tab: 'customers', access: value('access') }}
          />
        </section>
      )}
      {generations && (
        <section>
          <div className="cms-saas__panel-head cms-saas__standalone">
            <div>
              <h2>Generation history</h2>
              <p>
                Source → target → result. Photos are stored privately until
                explicitly deleted. Previously removed photos cannot be
                reopened.
              </p>
            </div>
            <form
              action="/admin/saas"
              method="get"
              className="cms-saas__search"
            >
              <input
                type="hidden"
                name={customer ? 'customer' : 'tab'}
                value={customer || 'generations'}
              />
              <label className="cms-saas__sr" htmlFor="job-search">
                Search job ID or customer email
              </label>
              <input
                id="job-search"
                name="jobSearch"
                defaultValue={value('jobSearch')}
                placeholder="Job ID or customer email"
              />
              <select
                name="stale"
                aria-label="Job freshness"
                defaultValue={value('stale')}
              >
                <option value="">All jobs</option>
                <option value="1">No update for 15+ minutes</option>
              </select>
              <label className="cms-saas__sr" htmlFor="job-state">
                Generation status
              </label>
              <select id="job-state" name="state" defaultValue={state}>
                <option value="">All statuses</option>
                {[
                  'queued',
                  'validating',
                  'processing',
                  'saving',
                  'succeeded',
                  'retry_wait',
                  'reconciling',
                  'failed',
                  'canceled',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button type="submit">Filter</button>
            </form>
          </div>
          <div className="cms-saas__jobs">
            {generations.jobs.map((j) => (
              <Job key={j.id} job={j} />
            ))}
          </div>
          {!generations.jobs.length && (
            <div className="cms-saas__empty">
              No generations match this view.
            </div>
          )}
          <Pager
            page={jobPage}
            total={generations.total}
            size={12}
            keyName="jobPage"
            values={{
              ...(customer ? { customer } : { tab: 'generations' }),
              state,
              jobSearch: value('jobSearch'),
              stale: value('stale'),
            }}
          />
        </section>
      )}
      {activity && (
        <section className="cms-saas__panel">
          <div className="cms-saas__panel-head">
            <div>
              <h2>Credit ledger</h2>
              <p>Latest 30 credit events for this customer.</p>
            </div>
          </div>
          <div className="cms-saas__table-wrap">
            <table className="cms-saas__table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Generation</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {activity.ledger.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.kind}
                      {l.metadata?.reason && <small>{l.metadata.reason}</small>}
                      {l.metadata?.actorEmail && (
                        <small>By {l.metadata.actorEmail}</small>
                      )}
                    </td>
                    <td>{l.amount}</td>
                    <td>
                      <code>{l.job_id || '—'}</code>
                    </td>
                    <td>{date(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!activity.ledger.length && (
            <p className="cms-saas__empty">No credit events yet.</p>
          )}
        </section>
      )}
      {billing && (
        <BillingView
          data={billing}
          customer={customer}
          search={value('billingSearch')}
          attention={value('attention') === '1'}
        />
      )}
      {!selected && tab === 'audit' && (
        <section className="cms-saas__panel">
          <div className="cms-saas__panel-head">
            <div>
              <h2>Owner activity</h2>
              <p>Latest 50 account access changes.</p>
            </div>
          </div>
          <div className="cms-saas__table-wrap">
            <table className="cms-saas__table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>Owner</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {operations.audit.map((a) => (
                  <tr key={a.id}>
                    <td>{a.email || 'Removed customer'}</td>
                    <td>{a.action}</td>
                    <td>{a.reason}</td>
                    <td>{a.owner_id}</td>
                    <td>{date(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!operations.audit.length && (
            <p className="cms-saas__empty">
              {operations.auditReady
                ? 'No account access changes yet.'
                : 'Apply the owner-audit migration to enable access changes.'}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
