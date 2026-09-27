import { describe, expect, it, vi } from 'vitest'
import { runRelease } from '../src/server/deployment/release'

const base = { DATABASE_URL: 'test-database', PAYLOAD_SECRET: 'test-secret' }
describe('deployment release', () => {
  it('runs both migration steps before owner setup', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    await runRelease({ env: { ...base, PAYLOAD_ADMIN_EMAIL: 'owner@example.com', PAYLOAD_ADMIN_PASSWORD: 'test-password' }, run, log: vi.fn() })
    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ['--import', 'tsx', 'scripts/migrate.ts'],
      ['node_modules/payload/bin.js', 'migrate'],
      ['--import', 'tsx', 'scripts/seed-admin.ts'],
    ])
  })

  it('fails the release and never seeds an owner if CMS migrations fail', async () => {
    const run = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('migration failed'))
    await expect(runRelease({ env: { ...base, PAYLOAD_ADMIN_EMAIL: 'owner@example.com', PAYLOAD_ADMIN_PASSWORD: 'test-password' }, run, log: vi.fn() })).rejects.toThrow('migration failed')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('supports later releases without owner credentials and reports the skip', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const log = vi.fn()
    await runRelease({ env: base, run, log })
    expect(run).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Owner setup skipped'))
  })

  it('rejects incomplete setup before running migrations', async () => {
    const run = vi.fn()
    await expect(runRelease({ env: { ...base, PAYLOAD_ADMIN_EMAIL: 'owner@example.com' }, run })).rejects.toThrow('Set both')
    await expect(runRelease({ env: {}, run })).rejects.toThrow('DATABASE_URL')
    expect(run).not.toHaveBeenCalled()
  })
})
