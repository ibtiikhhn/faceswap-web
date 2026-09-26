'use client'

import { useState } from 'react'
import { Upload, Wand2 } from 'lucide-react'

type UploadResult = {
  assetId: string
  width: number
  height: number
}

type JobResult = {
  id: string
  state: string
  result_asset_id?: string
  result_metadata?: { mock?: boolean; label?: string }
  error_message?: string
}

export function SwapUploader() {
  const [source, setSource] = useState<File | null>(null)
  const [target, setTarget] = useState<File | null>(null)
  const [job, setJob] = useState<JobResult | null>(null)
  const [message, setMessage] = useState<string>('')
  const [busy, setBusy] = useState(false)

  async function upload(kind: 'source' | 'target', file: File): Promise<UploadResult> {
    const form = new FormData()
    form.append('kind', kind)
    form.append('file', file)
    const response = await fetch('/api/uploads', {
      method: 'POST',
      body: form,
    })

    const body = await response.json()
    if (!response.ok) {
      throw new Error(body.error?.message ?? body.error ?? 'Could not upload image')
    }

    return body.asset as UploadResult
  }

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await fetch(`/api/swaps/${jobId}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? body.error ?? 'Could not load swap status')
      setJob(body.swap)
      if (['succeeded', 'failed', 'canceled'].includes(body.swap.state)) return
      await new Promise((resolve) => setTimeout(resolve, attempt < 5 ? 1000 : 2500))
    }
  }

  async function startSwap() {
    if (!source || !target) {
      setMessage('Choose both photos first.')
      return
    }

    setBusy(true)
    setMessage('')
    setJob(null)

    try {
      const [sourceUpload, targetUpload] = await Promise.all([
        upload('source', source),
        upload('target', target),
      ])

      const response = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceAssetId: sourceUpload.assetId,
          targetAssetId: targetUpload.assetId,
          requestKey: crypto.randomUUID(),
        }),
      })

      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? body.error ?? 'Could not create swap')
      setJob(body.job)
      await poll(body.job.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Swap failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <PhotoInput label="Source face" file={source} onChange={setSource} />
        <PhotoInput label="Target photo" file={target} onChange={setTarget} />
      </div>
      <button
        onClick={startSwap}
        disabled={busy}
        className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy ? <Upload size={18} /> : <Wand2 size={18} />}
        {busy ? 'Uploading' : 'Create swap'}
      </button>
      {message ? <p className="rounded-md border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">{message}</p> : null}
      {job ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <p className="font-semibold">Job {job.id}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">State: {job.state}</p>
          {job.result_metadata?.mock ? <p className="mt-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">{job.result_metadata.label}</p> : null}
          {job.result_asset_id ? (
            <a className="mt-3 inline-block rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white" href={`/api/assets/${job.result_asset_id}/download`}>
              Download result
            </a>
          ) : null}
          {job.error_message ? <p className="mt-1 text-sm text-red-700">{job.error_message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function PhotoInput({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="grid min-h-56 cursor-pointer place-items-center rounded-lg border border-dashed border-[var(--line)] bg-white p-5 text-center">
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <span>
        <Upload className="mx-auto mb-3 text-[var(--accent)]" />
        <span className="block font-semibold">{label}</span>
        <span className="mt-2 block text-sm text-[var(--muted)]">{file ? file.name : 'JPEG, PNG, or WebP'}</span>
      </span>
    </label>
  )
}
