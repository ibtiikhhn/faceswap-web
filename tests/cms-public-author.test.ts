import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn() }));
vi.mock('payload', () => ({ getPayload: async () => mocks }));
vi.mock('@payload-config', () => ({ default: {} }));
vi.mock('../src/server/env', () => ({ featureState: () => ({ payload: true }) }));

import { getPublishedPost } from '../src/server/cms';

describe('published author attribution', () => {
  beforeEach(() => vi.clearAllMocks());
  it('resolves only the display name from a private owner relationship', async () => {
    mocks.find.mockResolvedValue({ docs: [{ title: 'Guide', slug: 'guide', summary: 'Summary', author: 7 }] });
    mocks.findByID.mockResolvedValue({ name: 'Author Name', email: 'private@example.com' });
    const result = await getPublishedPost('guide');
    expect(mocks.find.mock.calls[0][0]).toMatchObject({ draft: false, overrideAccess: false });
    expect(mocks.findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 7, select: { name: true }, overrideAccess: true }));
    expect(result.post?.authorName).toBe('Author Name');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });
  it('does not fetch an author for an unpublished or missing article', async () => {
    mocks.find.mockResolvedValue({ docs: [] });
    expect((await getPublishedPost('missing')).post).toBeNull();
    expect(mocks.findByID).not.toHaveBeenCalled();
  });
});
