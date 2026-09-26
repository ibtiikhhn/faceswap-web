import type { CollectionConfig } from 'payload'
import { assertOrigin, boundedBody, HttpError } from '@/server/http'
import { grantOwnerCredits, listOwnerSaasOverview, setOwnerUserSuspension } from '@/cms/owner-services'

function requireOwner(req: { user?: any }) {
  if (!req.user) {
    throw new HttpError(401, 'Owner login required.', 'owner_login_required')
  }
  return {
    id: req.user.id,
    email: req.user.email,
  }
}

function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  console.error(error)
  return Response.json({ error: { code: 'internal_error', message: 'Something went wrong.' } }, { status: 500 })
}

function adminRedirect(req: { origin?: string }, search: URLSearchParams) {
  const baseURL = process.env.APP_URL ?? req.origin ?? 'http://localhost:3000'
  return Response.redirect(new URL(`/admin/saas?${search.toString()}`, baseURL), 303)
}

async function readCreditGrantBody(req: Request) {
  const bytes = await boundedBody(req, 8192)
  const parsed = new Response(bytes, { headers: req.headers })
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await parsed.json()
    return {
      userId: String(body.userId ?? ''),
      amount: Number(body.amount),
      reason: String(body.reason ?? ''),
      wantsHTML: false,
    }
  }

  const form = await parsed.formData()
  return {
    userId: String(form.get('userId') ?? ''),
    amount: Number(form.get('amount')),
    reason: String(form.get('reason') ?? ''),
    wantsHTML: true,
  }
}

export const Owners: CollectionConfig = {
  slug: 'owners',
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: 'Owner',
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  endpoints: [
    {
      method: 'post',
      path: '/first-register',
      handler: async () =>
        Response.json(
          {
            message: 'Owner bootstrap is invite-only. Run the seed admin CLI instead.',
          },
          { status: 404 },
        ),
    },
    {
      method: 'get',
      path: '/saas/overview',
      handler: async (req) => {
        try {
          requireOwner(req)
          return Response.json(await listOwnerSaasOverview())
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
    {
      method: 'post',
      path: '/saas/suspension',
      handler: async req => {
        try {
          const actor = requireOwner(req)
          assertOrigin(req as Request)
          const bytes = await boundedBody(req as Request, 8192)
          const form = await new Response(bytes, { headers: req.headers }).formData()
          const action = form.get('action')
          if (action !== 'suspend' && action !== 'restore') throw new HttpError(400, 'Invalid action.', 'invalid_action')
          await setOwnerUserSuspension({ actor, userId: String(form.get('userId') ?? ''), suspended: action === 'suspend', reason: String(form.get('reason') ?? '') })
          return adminRedirect(req, new URLSearchParams({ updated: 'account' }))
        } catch (error) { return errorResponse(error) }
      },
    },
    {
      method: 'post',
      path: '/saas/credits',
      handler: async (req) => {
        let wantsHTML = false
        try {
          const actor = requireOwner(req)
          assertOrigin(req as Request)
          const body = await readCreditGrantBody(req as Request)
          wantsHTML = body.wantsHTML
          await grantOwnerCredits({
            actor,
            userId: body.userId,
            amount: body.amount,
            reason: body.reason,
          })
          if (body.wantsHTML) return adminRedirect(req, new URLSearchParams({ updated: 'credits' }))
          return Response.json({ ok: true })
        } catch (error) {
          if (wantsHTML) {
            const message = error instanceof Error ? error.message : 'Credit grant failed.'
            return adminRedirect(req, new URLSearchParams({ error: message }))
          }
          return errorResponse(error)
        }
      },
    },
  ],
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      options: [{ label: 'Owner', value: 'owner' }],
      access: {
        update: () => false,
      },
    },
  ],
}
