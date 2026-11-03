import type { CollectionBeforeChangeHook, Where } from 'payload'

/** Legacy posts published without a date are public; future-dated posts remain hidden. */
export function publishedPostWhere(now = new Date().toISOString()): Where {
  return {
    and: [
      { _status: { equals: 'published' } },
      { or: [
        { publishedAt: { less_than_equal: now } },
        { publishedAt: { exists: false } },
      ] },
    ],
  }
}

export const setPostPublicationDate: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!data) return data
  const status = data._status ?? originalDoc?._status
  if (status === 'published' && !data.publishedAt) {
    return { ...data, publishedAt: originalDoc?.publishedAt || new Date().toISOString() }
  }
  return data
}

/** Use only a saved public API response, not the editor's unsaved form values. */
export function publishedPostPath(doc: { _status?: unknown; slug?: unknown; publishedAt?: unknown }, now = Date.now()) {
  if (doc._status !== 'published' || typeof doc.slug !== 'string' || !doc.slug.trim()) return null
  if (doc.publishedAt != null) {
    if (typeof doc.publishedAt !== 'string') return null
    const date = Date.parse(doc.publishedAt)
    if (!Number.isFinite(date) || date > now) return null
  }
  return `/blog/${encodeURIComponent(doc.slug)}`
}
