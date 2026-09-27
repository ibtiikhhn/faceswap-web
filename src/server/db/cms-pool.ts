/** Payload holds a connection for reconnect handling in addition to transactions. */
export function cmsPoolSize(value = process.env.CMS_DATABASE_POOL_MAX): number {
  if (value === undefined || value === '') return 4
  const size = Number(value)
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new Error('CMS_DATABASE_POOL_MAX must be a positive whole number.')
  }
  // Leave room for the adapter, job transactions, and nested CMS reads.
  return Math.max(4, size)
}
