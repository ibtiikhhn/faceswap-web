import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import { Categories } from '@/cms/collections/Categories'
import { Media } from '@/cms/collections/Media'
import { Owners } from '@/cms/collections/Owners'
import { Posts } from '@/cms/collections/Posts'
import { Redirects } from '@/cms/collections/Redirects'
import { SiteSettings } from '@/cms/collections/SiteSettings'
import { cmsPoolSize } from '@/server/db/cms-pool'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const hasR2 = Boolean(
  process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_PUBLIC_BUCKET,
)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'payload-dev-only-secret-replace-before-production',
  admin: {
    user: Owners.slug,
    importMap: {
      baseDir: path.resolve(dirname, 'src/app/(payload)'),
    },
    components: {
      afterNavLinks: ['@/app/(payload)/admin/SaaSNav'],
      views: {
        saas: {
          path: '/saas',
          Component: '@/app/(payload)/admin/SaaSOverview',
        },
      },
    },
    routes: {
      createFirstUser: '/owner-bootstrap-disabled',
    },
  },
  routes: {
    admin: '/admin',
  },
  editor: lexicalEditor(),
  collections: [Owners, Categories, Media, Posts, Redirects],
  globals: [SiteSettings],
  db: postgresAdapter({
    pool: {
      max: cmsPoolSize(),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      connectionString: process.env.DATABASE_URL || 'postgres://payload:payload@127.0.0.1:5432/payload_unconfigured',
    },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations/cms'),
    schemaName: 'cms',
  }),
  plugins: [
    s3Storage({
      enabled: hasR2,
      collections: {
        media: {
          prefix: 'blog-media',
        },
      },
      bucket: process.env.R2_PUBLIC_BUCKET || 'payload-media-unconfigured',
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || 'missing',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'missing',
        },
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
        region: 'auto',
      },
    }),
  ],
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
