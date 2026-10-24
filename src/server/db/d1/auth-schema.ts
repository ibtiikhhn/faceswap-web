import { sqliteTable, text, integer, uniqueIndex, customType } from 'drizzle-orm/sqlite-core';
const isoDate=customType<{data:Date;driverData:string}>({dataType:()=> 'text',toDriver:value=>value.toISOString(),fromDriver:value=>new Date(value)});
export const users = sqliteTable('app_users', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  stripeCustomerId: text('stripe_customer_id').unique(),
  suspendedAt: isoDate('suspended_at'),
  deletionRequestedAt: isoDate('deletion_requested_at'),
  createdAt: isoDate('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: isoDate('updated_at').notNull().$defaultFn(() => new Date()),
})

export const accounts = sqliteTable('app_accounts', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: isoDate('access_token_expires_at'),
  refreshTokenExpiresAt: isoDate('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: isoDate('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: isoDate('updated_at').notNull().$defaultFn(() => new Date()),
}, (table) => ({
  providerAccountKey: uniqueIndex('accounts_provider_account_key').on(table.providerId, table.accountId),
}))

export const sessions = sqliteTable('app_sessions', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: isoDate('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: isoDate('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: isoDate('updated_at').notNull().$defaultFn(() => new Date()),
})

export const verifications = sqliteTable('app_verifications', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: isoDate('expires_at').notNull(),
  createdAt: isoDate('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: isoDate('updated_at').notNull().$defaultFn(() => new Date()),
})

export const betterAuthSchema = {
  user: users,
  account: accounts,
  session: sessions,
  verification: verifications,
}

