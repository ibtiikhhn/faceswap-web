import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishedOnly } from '@/cms/access'
import { publishedPostPath, setPostPublicationDate } from '@/cms/post-publication'

afterEach(() => vi.useRealTimers())
const now = '2026-11-03T13:00:00.000Z'
const hook = (data: object, originalDoc?: object) => setPostPublicationDate({ data, originalDoc } as any)

describe('CMS publication lifecycle', () => {
  it('assigns a date when Publish is used without a manually entered date', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now))
    expect(await hook({ _status: 'published', title: 'Guide' })).toMatchObject({ publishedAt: now, title: 'Guide' })
  })
  it('does not assign a publication date to drafts or autosaves', async () => {
    expect(await hook({ _status: 'draft' })).not.toHaveProperty('publishedAt')
    expect(await hook({ _status: 'draft' }, { _status: 'published' })).not.toHaveProperty('publishedAt')
  })
  it('preserves existing and deliberately scheduled dates', async () => {
    expect(await hook({ title: 'Edited' }, { _status: 'published', publishedAt: now })).toHaveProperty('publishedAt', now)
    const future = '2027-01-01T00:00:00.000Z'
    expect(await hook({ _status: 'published', publishedAt: future })).toHaveProperty('publishedAt', future)
  })
  it('keeps the status gate while accepting legacy published posts with no date', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now))
    expect(publishedOnly({ req: { user: null } } as any)).toEqual({ and: [
      { _status: { equals: 'published' } },
      { or: [{ publishedAt: { less_than_equal: now } }, { publishedAt: { exists: false } }] },
    ] })
    expect(publishedOnly({ req: { user: { id: 1 } } } as any)).toBe(true)
  })
  it('only links saved public posts, including legacy missing dates', () => {
    const time = Date.parse(now)
    expect(publishedPostPath({ _status: 'published', slug: 'my post', publishedAt: null }, time)).toBe('/blog/my%20post')
    expect(publishedPostPath({ _status: 'published', slug: 'post', publishedAt: now }, time)).toBe('/blog/post')
    expect(publishedPostPath({ _status: 'draft', slug: 'post' }, time)).toBeNull()
    expect(publishedPostPath({ _status: 'published', slug: '' }, time)).toBeNull()
    expect(publishedPostPath({ _status: 'published', slug: 'post', publishedAt: '2027-01-01' }, time)).toBeNull()
    expect(publishedPostPath({ _status: 'published', slug: 'post', publishedAt: 'bad date' }, time)).toBeNull()
  })
})
