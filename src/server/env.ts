import { z } from 'zod'

function blankToUndefined(value: unknown) {
  return value === '' ? undefined : value
}

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional())
const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional())

const serverEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  SWAPS_ENABLED: z.enum(['true', 'false']).default('true'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  DATABASE_URL: optionalString,
  BETTER_AUTH_SECRET: z.preprocess(blankToUndefined, z.string().min(32).optional()),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  PAYLOAD_SECRET: z.preprocess(blankToUndefined, z.string().min(32).optional()),
  PADDLE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  PADDLE_BILLING_ENABLED: z.enum(['true', 'false']).default('false'),
  PADDLE_API_KEY: optionalString,
  PADDLE_CLIENT_TOKEN: optionalString,
  PADDLE_WEBHOOK_SECRET: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_WEEKLY_PRICE_ID: optionalString,
  STRIPE_MONTHLY_PRICE_ID: optionalString,
  STRIPE_YEARLY_PRICE_ID: optionalString,
  STRIPE_CREDIT_PACK_PRICE_ID: optionalString,
  R2_ENDPOINT: optionalUrl,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_PRIVATE_BUCKET: optionalString,
  R2_PUBLIC_BUCKET: optionalString,
  R2_ACCOUNT_ID: optionalString,
  R2_BUCKET: optionalString,
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('storage'),
  MOCK_SWAP_ENABLED: z.string().default('true'),
  FACE_SWAP_PROVIDER: z.enum(['mock', 'external']).optional(),
  SWAP_PROVIDER: z.enum(['mock', 'external']).default('mock'),
  CUSTOM_SWAP_URL: z.string().url().default('https://faceswap-django.onrender.com/faceswap_file/'),
  CUSTOM_SWAP_RESULT_HOSTS: z.string().default(''),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function getEnv(): ServerEnv {
  const parsed = serverEnvSchema.parse({
    ...process.env,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY ?? (process.env.PADDLE_ENVIRONMENT !== "production" ? process.env.PADDLE_SANDBOX_API_KEY : undefined),
    APP_URL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    SWAP_PROVIDER: process.env.SWAP_PROVIDER ?? process.env.FACE_SWAP_PROVIDER,
    R2_ENDPOINT:
      process.env.R2_ENDPOINT ??
      (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined),
    R2_PRIVATE_BUCKET: process.env.R2_PRIVATE_BUCKET ?? process.env.R2_BUCKET,
  })
  if (parsed.APP_ENV === 'production' && parsed.SWAPS_ENABLED === 'true' && (parsed.SWAP_PROVIDER === 'mock' || parsed.FACE_SWAP_PROVIDER === 'mock')) {
    throw new Error('Mock face-swap provider is not allowed when APP_ENV=production.')
  }
  if (parsed.SWAP_PROVIDER === 'external' && (!parsed.CUSTOM_SWAP_URL.startsWith('https://') || !parsed.CUSTOM_SWAP_RESULT_HOSTS.trim())) {
    throw new Error('External swaps require an HTTPS CUSTOM_SWAP_URL and CUSTOM_SWAP_RESULT_HOSTS.');
  }
  return parsed
}

export const env = getEnv

export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = getEnv()[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${String(key)}`)
  }
  return value as NonNullable<ServerEnv[K]>
}

export function featureState() {
  const parsed = getEnv()
  return {
    database: Boolean(parsed.DATABASE_URL),
    auth: Boolean(parsed.DATABASE_URL && parsed.BETTER_AUTH_SECRET && parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET),
    stripe: false, // Stripe retired; Paddle integration is pending.
    swapsEnabled: parsed.SWAPS_ENABLED === 'true',
    storage: Boolean(parsed.R2_ENDPOINT && parsed.R2_ACCESS_KEY_ID && parsed.R2_SECRET_ACCESS_KEY && parsed.R2_PRIVATE_BUCKET),
    payload: Boolean(parsed.DATABASE_URL && parsed.PAYLOAD_SECRET),
    mockSwap: parsed.SWAP_PROVIDER === 'mock',
  }
}
