import { json } from '@/server/http'

export async function POST() {
  return json({
    error: {
      code: 'deprecated_upload_flow',
      message: 'Use POST /api/uploads with multipart form data.',
    },
  }, 410)
}
