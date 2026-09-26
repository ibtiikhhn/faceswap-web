import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { describe, it } from 'vitest'
import { grantOwnerCredits, listOwnerSaasOverview, setOwnerUserSuspension } from '@/cms/owner-services'
import type { DbClient } from '@/server/db'

async function db() {
  const client = new PGlite()
  const migration = (await fs.readFile(path.join(process.cwd(), 'migrations/app/0001_initial.sql'), 'utf8'))
    .replace(/create extension if not exists pgcrypto;/gi, '')
    .replaceAll(
      'default gen_random_uuid()',
      "default ('00000000-0000-4000-8000-' || lpad(nextval('app.test_uuid_seq')::text, 12, '0'))::uuid",
    )
    .replace('create schema if not exists app;', 'create schema if not exists app; create sequence if not exists app.test_uuid_seq;')
  await client.exec(migration)
  for (const file of ['0004_security.sql', '0007_owner_audit.sql']) {
    await client.exec((await fs.readFile(path.join(process.cwd(), 'migrations/app', file), 'utf8')).replaceAll('default gen_random_uuid()', "default ('00000000-0000-4000-8000-' || lpad(nextval('app.test_uuid_seq')::text, 12, '0'))::uuid"))
  }
  return client as unknown as DbClient & PGlite
}

describe('CMS owner services', () => {
  it('suspends and restores access with audit records, but never restores a deleted account', async () => {
    const client = await db()
    const result = await client.query<{ id: string }>("insert into app.users(email) values('access@example.com') returning id")
    const input = { client, actor: { id: 7 }, userId: result.rows[0].id, reason: 'Owner reviewed access' }
    await setOwnerUserSuspension({ ...input, suspended: true })
    assert.ok((await client.query('select suspended_at from app.users where id=$1', [input.userId])).rows[0].suspended_at)
    await setOwnerUserSuspension({ ...input, suspended: false })
    assert.equal((await client.query('select suspended_at from app.users where id=$1', [input.userId])).rows[0].suspended_at, null)
    assert.equal((await client.query('select * from app.owner_audit')).rows.length, 2)
    await client.query('update app.users set deletion_requested_at=now() where id=$1', [input.userId])
    await assert.rejects(setOwnerUserSuspension({ ...input, suspended: false }), /cannot be restored/)
    await client.close()
  })
  it('grants user credits with owner metadata in the ledger', async () => {
    const client = await db()
    const user = await client.query<{ id: string }>("insert into app.users (email) values ('member@example.com') returning id")

    await grantOwnerCredits({
      client,
      actor: { id: 7, email: 'owner@example.com' },
      userId: user.rows[0].id,
      amount: 5,
      reason: 'Launch make-good',
    })

    const overview = await listOwnerSaasOverview(client)
    assert.equal(overview.totals.users, 1)
    assert.equal(overview.totals.creditsAvailable, 5)
    assert.equal(overview.users[0].creditsAvailable, 5)

    const ledger = await client.query<{ amount: number; metadata: any }>('select amount, metadata from app.credit_ledger')
    assert.equal(Number(ledger.rows[0].amount), 5)
    assert.equal(ledger.rows[0].metadata.actorType, 'owner')
    assert.equal(ledger.rows[0].metadata.actorEmail, 'owner@example.com')
    assert.equal(ledger.rows[0].metadata.reason, 'Launch make-good')
  })
})
