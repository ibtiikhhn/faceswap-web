type ReleaseOptions = {
  env: Record<string, string | undefined>
  run: (args: string[]) => Promise<void>
  log?: (message: string) => void
}

export async function runRelease({ env, run, log = console.log }: ReleaseOptions) {
  if (!env.DATABASE_URL || !env.PAYLOAD_SECRET) {
    throw new Error('Release requires DATABASE_URL and PAYLOAD_SECRET.')
  }
  const email = Boolean(env.PAYLOAD_ADMIN_EMAIL)
  const password = Boolean(env.PAYLOAD_ADMIN_PASSWORD)
  if (email !== password) {
    throw new Error('Set both PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD, or remove both after owner setup.')
  }

  log('[release 1/3] Running application migrations...')
  await run(['--import', 'tsx', 'scripts/migrate.ts'])
  log('[release 2/3] Running CMS migrations...')
  await run(['node_modules/payload/bin.js', 'migrate'])
  if (email && password) {
    log('[release 3/3] Creating or checking the CMS owner...')
    await run(['--import', 'tsx', 'scripts/seed-admin.ts'])
  } else {
    log('[release 3/3] Owner setup skipped: no bootstrap credentials. For first-time setup, set PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD.')
  }
  log('[release] Completed successfully.')
}
