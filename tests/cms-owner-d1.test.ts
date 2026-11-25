import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { testD1 } from './helpers/d1';
import {
  listOwnerSaasOverview,
  listOwnerGenerations,
  getOwnerCustomerActivity,
  listOwnerOperations,
} from '@/cms/owner-services';

it('loads owner customer, generation and billing views on D1 and preserves explicitly deleted assets', async () => {
  const db = testD1();
  try {
    const user = (
      await db.query<{ id: string }>(
        "insert into app.users(email,name) values('owner-test@example.com','Test Customer') returning id",
      )
    ).rows[0].id;
    const ids: string[] = [];
    for (const kind of ['source', 'target', 'result'])
      ids.push(
        (
          await db.query<{ id: string }>(
            "insert into app.assets(user_id,kind,object_key,content_type,width,height,byte_count,expires_at) values($1,$2,$2,'image/webp',100,100,10,'2020-01-01') returning id",
            [user, kind],
          )
        ).rows[0].id,
      );
    await db.query(
      "insert into app.swap_jobs(user_id,source_asset_id,target_asset_id,result_asset_id,state,request_key) values($1,$2,$3,$4,'succeeded','d1-owner-job')",
      [user, ...ids],
    );
    await db.query("update app.assets set status='deleted' where id=$1", [
      ids[1],
    ]);
    db.sqlite.exec(
      readFileSync('migrations/d1/app/0003_keep_photos.sql', 'utf8'),
    );
    const summary = await listOwnerSaasOverview(db, {
      search: 'TEST CUSTOMER',
      customerId: user,
    });
    expect(summary.matchedUsers).toBe(1);
    expect(summary.totals.swapsSucceeded).toBe(1);
    const history = await listOwnerGenerations({ userId: user }, db);
    expect(history.total).toBe(1);
    expect(history.jobs[0]).toMatchObject({
      source_expires: null,
      target_status: 'deleted',
      result_asset_id: ids[2],
      result_expires: null,
    });
    expect((await listOwnerGenerations({ state: 'failed' }, db)).total).toBe(0);
    expect(await getOwnerCustomerActivity(user, db)).toEqual({
      subscriptions: [],
      ledger: [],
    });
    expect((await listOwnerOperations(db)).auditReady).toBe(true);
  } finally {
    await db.close();
  }
});

it('sorts guest and paid jobs together newest first across date boundaries and pages', async () => {
  const db = testD1();
  try {
    const u = (
      await db.query<{ id: string }>(
        "insert into app.users(email) values('ordering@example.test') returning id",
      )
    ).rows[0].id;
    const guest = (
      await db.query<{ id: string }>(
        "insert into app.guest_sessions(token_hash,expires_at) values('ordering','2027-01-01') returning id",
      )
    ).rows[0].id;
    const assets: string[] = [];
    for (const kind of ['source', 'target'])
      assets.push(
        (
          await db.query<{ id: string }>(
            "insert into app.assets(guest_id,kind,object_key,content_type,width,height,byte_count) values($1,$2,$2,'image/webp',100,100,10) returning id",
            [guest, kind],
          )
        ).rows[0].id,
      );
    const expected: string[] = [];
    for (let i = 0; i < 14; i++) {
      const created = new Date(Date.UTC(2026, 10, 23, 18 + i)).toISOString();
      const row = (
        await db.query<{ id: string }>(
          'insert into app.swap_jobs(user_id,guest_id,source_asset_id,target_asset_id,request_key,mode,created_at) values($1,$2,$3,$4,$5,$6,$7) returning id',
          [
            i % 2 ? null : u,
            i % 2 ? guest : null,
            ...assets,
            `order-${i}`,
            i % 2 ? 'guest_trial' : 'paid_credit',
            created,
          ],
        )
      ).rows[0];
      expected.unshift(row.id);
    }
    const first = await listOwnerGenerations({}, db),
      second = await listOwnerGenerations({ page: 2 }, db);
    expect(first.jobs.map((j) => j.id)).toEqual(expected.slice(0, 12));
    expect(second.jobs.map((j) => j.id)).toEqual(expected.slice(12));
    expect(first.jobs[0].mode).toBe('guest_trial');
    expect(first.jobs[1].mode).toBe('paid_credit');
  } finally {
    await db.close();
  }
});
