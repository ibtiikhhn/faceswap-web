import config from '@payload-config'
import '@payloadcms/next/css'
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'
import { featureState } from '@/server/env'

type PayloadRouteArgs = {
  params: Promise<{ slug?: string[] }>
}

const restGet = REST_GET(config)
const restPost = REST_POST(config)
const restDelete = REST_DELETE(config)
const restPatch = REST_PATCH(config)
const restPut = REST_PUT(config)
const restOptions = REST_OPTIONS(config)

function setupRequiredResponse() {
  return Response.json(
    {
      message: 'Payload setup required. Configure DATABASE_URL and PAYLOAD_SECRET before using the CMS API.',
      setupRequired: true,
    },
    { status: 503 },
  )
}

async function isDisabledOwnerBootstrap(args: PayloadRouteArgs) {
  const params = await args.params
  const slug = params.slug ?? []
  return slug.length === 2 && slug[0] === 'owners' && slug[1] === 'first-register'
}

export async function GET(request: Request, args: PayloadRouteArgs) {
  if (!featureState().payload) return setupRequiredResponse()
  return restGet(request, args)
}

export async function POST(request: Request, args: PayloadRouteArgs) {
  if (!featureState().payload) return setupRequiredResponse()
  if (await isDisabledOwnerBootstrap(args)) {
    return Response.json(
      {
        message: 'Owner bootstrap is invite-only. Run the seed admin CLI instead.',
      },
      { status: 404 },
    )
  }
  return restPost(request, args)
}

export async function DELETE(request: Request, args: PayloadRouteArgs) {
  if (!featureState().payload) return setupRequiredResponse()
  return restDelete(request, args)
}

export async function PATCH(request: Request, args: PayloadRouteArgs) {
  if (!featureState().payload) return setupRequiredResponse()
  return restPatch(request, args)
}

export async function PUT(request: Request, args: PayloadRouteArgs) {
  if (!featureState().payload) return setupRequiredResponse()
  return restPut(request, args)
}

export async function OPTIONS(request: Request, args: PayloadRouteArgs) {
  if (!featureState().payload) return setupRequiredResponse()
  return restOptions(request, args)
}
