import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { env, featureState, requireEnv } from '@/server/env'
import { getDb } from '@/server/db'
import { betterAuthSchema } from '@/server/db/schema'

let authInstance: ReturnType<typeof createAuth> | undefined

export function createAuth() {
  if (!featureState().auth) {
    throw new Error('Auth is not configured. Set DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.')
  }

  const parsed = env()

  return betterAuth({
    baseURL: parsed.APP_URL,
    secret: requireEnv('BETTER_AUTH_SECRET'),
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schemaName: 'app',
      schema: betterAuthSchema,
    }),
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    socialProviders: {
      google: {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      },
    },
  })
}

export function getAuth() {
  authInstance ??= createAuth()
  return authInstance
}

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop)
  },
})
