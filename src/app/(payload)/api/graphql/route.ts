import config from '@payload-config'
import { GRAPHQL_POST, REST_OPTIONS } from '@payloadcms/next/routes'
import { featureState } from '@/server/env'

const graphqlPost = GRAPHQL_POST(config)
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

export function POST(request: Request) {
  if (!featureState().payload) return setupRequiredResponse()
  return graphqlPost(request)
}

export function OPTIONS(request: Request, args: any) {
  if (!featureState().payload) return setupRequiredResponse()
  return restOptions(request, args)
}
