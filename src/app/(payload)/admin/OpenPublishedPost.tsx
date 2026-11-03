'use client'

import { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { publishedPostPath } from '@/cms/post-publication'

export default function OpenPublishedPost() {
  const { id, lastUpdateTime } = useDocumentInfo()
  const [result, setResult] = useState<{ id: string | number; updated: number; path: string | null; error: boolean } | null>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    async function load() {
      try {
        // Anonymous access deliberately resolves only the version the public can see.
        const response = await fetch(`/api/posts/${encodeURIComponent(String(id))}?draft=false&depth=0&select[slug]=true&select[_status]=true&select[publishedAt]=true`, {
          credentials: 'omit', cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok && response.status !== 404 && response.status !== 403) throw new Error('Publication check failed')
        const path = response.ok ? publishedPostPath(await response.json()) : null
        if (!controller.signal.aborted) setResult({ id: id!, updated: lastUpdateTime, path, error: false })
      } catch {
        if (!controller.signal.aborted) setResult({ id: id!, updated: lastUpdateTime, path: null, error: true })
      }
    }
    void load()
    return () => controller.abort()
  }, [id, lastUpdateTime])

  if (!id) return <p>Publish this post to get its public link.</p>
  if (!result || result.id !== id || result.updated !== lastUpdateTime) return <p role="status">Checking published URL…</p>
  if (result.error) return <p role="status">Could not check the public URL. Reload to try again.</p>
  if (!result.path) return <p>This post is not public yet. Publish it and check that its publication date is not in the future.</p>
  return <a href={result.path} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', margin: '12px 0', fontWeight: 600 }}>Open published post ↗</a>
}
