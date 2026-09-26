import { getPayload } from 'payload'
import config from '@payload-config'

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

if (!process.env.DATABASE_URL || !process.env.PAYLOAD_SECRET) {
  throw new Error('Set DATABASE_URL and PAYLOAD_SECRET before running cms:seed-admin.')
}

if (!email || !password) {
  throw new Error('Set PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD before running cms:seed-admin.')
}

const payload = await getPayload({ config })
const existing = await payload.find({
  collection: 'owners',
  where: {
    email: {
      equals: email,
    },
  },
  limit: 1,
})

if (existing.docs.length) {
  console.log(`Owner already exists: ${email}`)
  process.exit(0)
}

await payload.create({
  collection: 'owners',
  data: {
    email,
    password,
    name: 'Owner',
    role: 'owner',
  },
})

console.log(`Created owner: ${email}`)
process.exit(0)
