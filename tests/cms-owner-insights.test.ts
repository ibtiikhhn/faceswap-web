import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { testD1 } from './helpers/d1';
import { ownerBilling, ownerInsights } from '@/cms/owner-insights';
import { grantOwnerCredits, listOwnerGenerations } from '@/cms/owner-services';
import type { DbClient } from '@/server/db';

async function database(backend: string) {
  if (backend === 'd1') return testD1();
  const db = new PGlite();
  for (const file of readdirSync('migrations/app')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(
      readFileSync(`migrations/app/${file}`, 'utf8')
        .replace(/create extension if not exists pgcrypto;/gi, '')
        .replaceAll(
          'default gen_random_uuid()',
          "default ('00000000-0000-4000-8000-' || lpad(nextval('app.test_uuid_seq')::text,12,'0'))::uuid",
        )
        .replace(
          'create schema if not exists app;',
          'create schema if not exists app; create sequence if not exists app.test_uuid_seq;',
        ),
    );
  }
  return db as unknown as DbClient & { close: () => Promise<void> };
}
describe.each(['d1', 'postgres'])('Owner operations on %s', (backend) => {
  it('isolates payment environments, customer records, search and attention filters', async () => {
    const db = await database(backend);
    try {
      const u = (
        await db.query<{ id: string }>(
          "insert into app.users(email) values('billing@example.test') returning id",
        )
      ).rows[0].id;
      const other = (
        await db.query<{ id: string }>(
          "insert into app.users(email) values('other@example.test') returning id",
        )
      ).rows[0].id;
      for (const [id, user, env, disputed] of [
        ['pay_live', u, 'production', true],
        ['pay_other', other, 'production', false],
        ['pay_sandbox', u, 'sandbox', false],
      ] as const)
        await db.query(
          'insert into app.whop_payments(id,user_id,environment,disputed,updated_at) values($1,$2,$3,$4,now())',
          [id, user, env, disputed],
        );
      await db.query(
        "insert into app.whop_event_inbox(id,environment,type,resource_id,state,attempts) values('evt_live','production','payment.succeeded','pay_live','failed',30)",
      );
      const all = await ownerBilling({}, db);
      expect(all.total).toBe(2);
      expect(Number(all.stats.exhausted)).toBe(1);
      const scoped = await ownerBilling({ userId: u }, db);
      expect(scoped.payments.map((p) => p.id)).toEqual(['pay_live']);
      expect(scoped.events).toEqual([]);
      expect(
        (await ownerBilling({ environment: 'sandbox' }, db)).payments.map(
          (p) => p.id,
        ),
      ).toEqual(['pay_sandbox']);
      expect((await ownerBilling({ attention: true }, db)).total).toBe(1);
      expect((await ownerBilling({ search: 'pay_other' }, db)).total).toBe(1);
      expect((await ownerBilling({ search: "' OR 1=1 --" }, db)).total).toBe(0);
    } finally {
      await db.close();
    }
  });
  it('zero-fills trends, detects stale jobs and retries credit grants without duplicating credits', async () => {
    const db = await database(backend);
    try {
      const u = (
        await db.query<{ id: string }>(
          "insert into app.users(email) values('support@example.test') returning id",
        )
      ).rows[0].id;
      const grant = {
        client: db,
        actor: { id: 1 },
        userId: u,
        amount: 20,
        reason: 'Support adjustment',
        requestKey: '11111111-1111-4111-8111-111111111111',
      };
      const a = await grantOwnerCredits(grant),
        b = await grantOwnerCredits(grant);
      expect(a.grantId).toBe(b.grantId);
      expect(
        (await db.query('select * from app.credit_ledger')).rows,
      ).toHaveLength(1);
      await expect(
        grantOwnerCredits({ ...grant, amount: 40 }),
      ).rejects.toMatchObject({ code: 'action_conflict' });
      const ids = [];
      for (const kind of ['source', 'target'])
        ids.push(
          (
            await db.query<{ id: string }>(
              "insert into app.assets(user_id,kind,object_key,content_type,width,height,byte_count) values($1,$2,$2,'image/webp',100,100,2048) returning id",
              [u, kind],
            )
          ).rows[0].id,
        );
      await db.query(
        "insert into app.swap_jobs(user_id,source_asset_id,target_asset_id,request_key,state,created_at,updated_at,error_code) values($1,$2,$3,'testjob','failed','2026-11-23T10:00:00Z','2026-11-23T10:00:00Z','provider_error')",
        [u, ...ids],
      );
      await db.query(
        "insert into app.swap_jobs(user_id,source_asset_id,target_asset_id,request_key,state,created_at,updated_at) values($1,$2,$3,'oldjob','processing','2026-11-23T11:00:00Z','2020-01-01T00:00:00Z')",
        [u, ...ids],
      );
      const info = await ownerInsights(7, db, new Date('2026-11-24T12:00:00Z'));
      expect(info.daily).toHaveLength(7);
      expect(info.daily[5]).toMatchObject({
        day: '2026-11-23',
        total: 2,
        failed: 1,
      });
      expect(Number(info.jobs.stale)).toBe(1);
      expect(Number(info.storage.bytes)).toBe(4096);
      expect(
        (await listOwnerGenerations({ search: 'SUPPORT@', stale: true }, db))
          .total,
      ).toBe(1);
      expect((await listOwnerGenerations({ search: 'nobody' }, db)).total).toBe(
        0,
      );
    } finally {
      await db.close();
    }
  });
});
