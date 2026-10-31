/** Draft first; --publish promotes a draft. Explicit --replace-content backs up an existing guide. */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getPayload } from 'payload';
import config from '../payload.config';
import { photoSwapGuide } from '../src/content/photo-swap-guide';

const authorId = Number(process.argv.find(arg => arg.startsWith('--author-id='))?.split('=')[1]);
if (!Number.isInteger(authorId) || authorId < 1) throw new Error('Pass the existing CMS owner ID with --author-id.');
const publish = process.argv.includes('--publish');
const replaceContent = process.argv.includes('--replace-content');
const expectedUpdatedAt = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
if (replaceContent && (!publish || !expectedUpdatedAt)) throw new Error('Content replacement requires --publish and --expected-updated-at from the reviewed CMS record.');
const payload = await getPayload({ config });
try {
  const author = await payload.findByID({ collection: 'owners', id: authorId, depth: 0, overrideAccess: true, select: { name: true } });
  if (!author.name?.trim() || author.name.trim() === 'Owner') throw new Error('Set the author’s real display name in the CMS before creating the article.');
  const existing = await payload.find({ collection: 'posts', depth: 0, draft: true, overrideAccess: true, limit: 1, where: { slug: { equals: photoSwapGuide.slug } } });
  if (existing.docs[0]) {
    const post = existing.docs[0];
    if (replaceContent) {
      if (post.updatedAt !== expectedUpdatedAt) throw new Error('The CMS post changed after review. Read the latest version before replacing content.');
      const backupPath = join(tmpdir(), `photo-swap-guide-${post.id}-${Date.now()}.json`);
      await writeFile(backupPath, JSON.stringify(post, null, 2), { mode: 0o600 });
      await payload.update({ collection: 'posts', id: post.id, overrideAccess: true, data: { ...photoSwapGuide, _status: 'published' } });
      console.log(`Updated guide ${post.id}; preserved author and publication date. Backup: ${backupPath}`);
    } else if (publish && post._status !== 'published') {
      await payload.update({ collection: 'posts', id: post.id, overrideAccess: true, data: { _status: 'published', publishedAt: new Date().toISOString() } });
      console.log(`Published saved guide ${post.id}. Existing content preserved.`);
    } else console.log(`Guide ${post.id} already exists (${post._status}); no content overwritten.`);
  } else {
    if (publish) throw new Error('Create and verify the draft before using --publish.');
    const post = await payload.create({ collection: 'posts', draft: true, overrideAccess: true, data: { ...photoSwapGuide, author: authorId, _status: 'draft' } });
    console.log(`Created draft ${post.id}: ${post.slug}`);
  }
} finally { await payload.destroy(); }
