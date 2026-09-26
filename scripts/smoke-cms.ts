/** Creates and removes isolated CMS fixtures on a local database only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPayload } from 'payload';
import config from '@payload-config';
const base = process.env.APP_URL ?? 'http://localhost:3099';
for (const url of [base, process.env.DATABASE_URL ?? '']) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('CMS smoke test is restricted to local services.');
}
const payload = await getPayload({ config });
const suffix = randomUUID();
const password = randomUUID() + randomUUID();
let ownerId: number | undefined;
let postId: number | undefined;
try {
  const owner = await payload.create({ collection: 'owners', data: { email: `smoke-${suffix}@example.invalid`, password, name: 'Temporary smoke test', role: 'owner' } });
  ownerId = owner.id;
  const response = await fetch(`${base}/api/owners/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: owner.email, password }), signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, 'Owner can log in');
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie);
  const slug = `smoke-${suffix}`;
  const content = { root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children: [{ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, children: [{ type: 'text', version: 1, text: 'Temporary CMS smoke test.', detail: 0, format: 0, mode: 'normal', style: '' }] }] } };
  const post = await payload.create({ collection: 'posts', draft: true, data: { title: 'CMS verification', slug, summary: 'Temporary test of publishing and private drafts.', author: owner.id, publishedAt: new Date().toISOString(), content: content as any, _status: 'draft' } });
  postId = post.id;
  const draft = await fetch(`${base}/api/posts/${post.id}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(draft.status, 404, 'Anonymous visitors cannot read drafts');
  const versions = await fetch(`${base}/api/posts/versions`, { signal: AbortSignal.timeout(20000) });
  assert.ok([401,403].includes(versions.status), 'Anonymous visitors cannot read revisions');
  await payload.update({ collection: 'posts', id: post.id, data: { _status: 'published' } });
  const publicPost = await fetch(`${base}/blog/${slug}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(publicPost.status, 200);
  assert.match(await publicPost.text(), /Temporary CMS smoke test/);
  const overview = await fetch(`${base}/api/owners/saas/overview`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
  assert.equal(overview.status, 200);
  const admin = await fetch(`${base}/admin/saas`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
  assert.equal(admin.status, 200);
  assert.ok((await admin.text()).includes('SaaS overview'), 'Owner SaaS view renders');
  const bootstrap = await fetch(`${base}/api/owners/first-register`, { method: 'POST', headers: { Origin: base }, signal: AbortSignal.timeout(20000) });
  assert.equal(bootstrap.status, 404);
  console.log('PASS: owner login, private drafts/revisions, published blog rendering, owner dashboard, and disabled public bootstrap.');
} finally {
  if (postId) await payload.delete({ collection: 'posts', id: postId });
  if (ownerId) await payload.delete({ collection: 'owners', id: ownerId });
  console.log('Temporary CMS records removed.');
  await payload.destroy();
}

process.exit(0);
