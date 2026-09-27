import { getPayload } from 'payload'
import config from '@payload-config'

// A short-lived process also releases any connections left open by the adapter.
// Await the full batch before exiting so completed writes have been committed.
try {
  const payload = await getPayload({ config })
  await payload.jobs.run({ allQueues: true, limit: 10, sequential: true })
  process.exit(0)
} catch (error) {
  console.error('CMS publishing batch failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
}
