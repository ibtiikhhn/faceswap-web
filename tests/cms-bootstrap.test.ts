import assert from 'node:assert/strict'
import { describe, it, vi } from 'vitest'

describe('CMS owner bootstrap', () => {
  it('does not expose public first-owner registration', async () => {
    process.env.DATABASE_URL = 'postgres://payload:payload@127.0.0.1:5433/faceswap'
    process.env.PAYLOAD_SECRET = 'test-payload-secret-with-32-characters'

    vi.doMock('@payload-config', () => ({ default: {} }))
    vi.doMock('@payloadcms/next/css', () => ({}))
    vi.doMock('@payloadcms/next/routes', () => ({
      REST_DELETE: () => () => Response.json({ ok: true }),
      REST_GET: () => () => Response.json({ ok: true }),
      REST_OPTIONS: () => () => Response.json({ ok: true }),
      REST_PATCH: () => () => Response.json({ ok: true }),
      REST_POST: () => () => Response.json({ ok: true }),
      REST_PUT: () => () => Response.json({ ok: true }),
    }))

    const routePath = '../src/app/(payload)/api/[...slug]/route.ts?cms-bootstrap' as string
    const route = await import(routePath)
    const response = await route.POST(new Request('http://localhost:3099/api/owners/first-register', { method: 'POST' }), {
      params: Promise.resolve({ slug: ['owners', 'first-register'] }),
    })

    assert.equal(response.status, 404)
    assert.equal((await response.json()).message, 'Owner bootstrap is invite-only. Run the seed admin CLI instead.')
  })

  it('does not expose the renamed admin first-user route', async () => {
    const page = await import('../src/app/(payload)/admin/owner-bootstrap-disabled/page')

    assert.throws(() => page.default(), /NEXT_HTTP_ERROR_FALLBACK;404/)
  })
})
