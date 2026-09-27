import { spawn } from 'node:child_process'

/** A dependency's unhandled client error must not kill the durable swap worker. */
export function runIsolatedNodeTask(args: string[], timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    let timedOut = false
    let killTimer: NodeJS.Timeout | undefined
    const deadline = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000)
    }, timeoutMs)

    const clearTimers = () => {
      clearTimeout(deadline)
      if (killTimer) clearTimeout(killTimer)
    }
    child.once('error', (error) => {
      clearTimers()
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimers()
      if (timedOut) reject(new Error('CMS publishing exceeded its time limit; the batch process was stopped.'))
      else if (code !== 0) reject(new Error(`CMS publishing process exited with ${signal ?? `code ${code}`}.`))
      else resolve()
    })
  })
}
