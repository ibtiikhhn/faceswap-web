import type { Metadata } from 'next'
import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { featureState } from '@/server/env'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  featureState().payload ? generatePageMetadata({ config, params, searchParams }) : Promise.resolve({ title: 'Admin setup' })

export default function Page({ params, searchParams }: Args) {
  if (!featureState().payload) {
    return (
      <main style={{ maxWidth: 760, margin: '64px auto', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}>
        <h1>Admin setup required</h1>
        <p>Payload is installed, but DATABASE_URL and PAYLOAD_SECRET are required before the admin can connect.</p>
        <p>Run the owner seed script after migrations to create the first invite-only admin account.</p>
      </main>
    )
  }

  return RootPage({ config, params, searchParams, importMap })
}
