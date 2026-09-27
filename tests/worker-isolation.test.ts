import { describe, expect, it } from 'vitest'
import { runIsolatedNodeTask } from '../src/worker/isolated-task'
import { cmsPoolSize } from '../src/server/db/cms-pool'

describe('CMS publishing isolation', () => {
  it('contains an unhandled client error and can run the next batch', async () => {
    await expect(runIsolatedNodeTask(['-e', `
      const { EventEmitter } = require('node:events');
      new EventEmitter().emit('error', new Error('idle-in-transaction timeout'));
    `])).rejects.toThrow('code 1')
    await expect(runIsolatedNodeTask(['-e', 'process.exit(0)'])).resolves.toBeUndefined()
  })

  it('terminates a stuck publishing process', async () => {
    await expect(runIsolatedNodeTask(['-e', 'setInterval(() => {}, 1000)'], 100))
      .rejects.toThrow('exceeded its time limit')
  })

  it('keeps enough CMS connections available and validates configuration', () => {
    expect(cmsPoolSize('')).toBe(4)
    expect(cmsPoolSize('1')).toBe(4)
    expect(cmsPoolSize('2')).toBe(4)
    expect(cmsPoolSize('8')).toBe(8)
    expect(() => cmsPoolSize('NaN')).toThrow('positive whole number')
    expect(() => cmsPoolSize('0')).toThrow('positive whole number')
  })
})
