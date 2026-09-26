import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { publishedOnly } from '@/cms/access'

describe('CMS public access', () => {
  it('filters public post reads to published posts whose publish time has arrived', () => {
    const access = publishedOnly({ req: { user: null } } as any)

    assert.deepEqual(access, {
      and: [
        {
          _status: {
            equals: 'published',
          },
        },
        {
          publishedAt: {
            less_than_equal: (access as any).and[1].publishedAt.less_than_equal,
          },
        },
      ],
    })
    assert.match((access as any).and[1].publishedAt.less_than_equal, /^\d{4}-\d{2}-\d{2}T/)
  })

  it('allows signed-in owners to read draft posts in the admin', () => {
    const access = publishedOnly({ req: { user: { id: 1 } } } as any)

    assert.equal(access, true)
  })
})
