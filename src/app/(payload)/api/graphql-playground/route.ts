import config from '@payload-config'
import '@payloadcms/next/css'
import { GRAPHQL_PLAYGROUND_GET } from '@payloadcms/next/routes'
import { featureState } from '@/server/env'

const graphqlPlaygroundGet = GRAPHQL_PLAYGROUND_GET(config)

export function GET(request: Request) {
  if (!featureState().payload) {
    return Response.json(
      {
        message: 'Payload setup required. Configure DATABASE_URL and PAYLOAD_SECRET before using the CMS API.',
        setupRequired: true,
      },
      { status: 503 },
    )
  }
  return graphqlPlaygroundGet(request)
}
