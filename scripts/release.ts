import { spawn } from 'node:child_process'
import { runRelease } from '../src/server/deployment/release'

// Sequence commands ourselves: no dependency on a hosting platform's shell parsing.
try {
  await runRelease({
    env: process.env,
    run: args => new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env })
      child.once('error', reject)
      child.once('close', (code, signal) => {
        if (code === 0) resolve()
        else reject(new Error(`Release step failed (${signal ?? `exit ${code}`}); remaining steps were not run.`))
      })
    }),
  })
} catch (error) {
  console.error('[release]', error instanceof Error ? error.message : 'Release failed.')
  process.exitCode = 1
}
