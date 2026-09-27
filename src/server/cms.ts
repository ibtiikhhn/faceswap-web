import { getPayload } from 'payload'
import config from '@payload-config'
import { featureState } from '@/server/env'

export type PublishedPost = {
  title: string
  slug: string
  summary: string
  publishedAt: string | null
  content: unknown
  cover: {
    url: string | null
    alt: string | null
  }
  updatedAt?: string | null
  canonicalUrl?: string | null
  socialImage?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
}

export type CmsListResult = {
  setupRequired: boolean
  posts: PublishedPost[]
}

export type CmsPostResult = {
  setupRequired: boolean
  post: PublishedPost | null
}

export async function getPublishedPosts(): Promise<CmsListResult> {
  if (!featureState().payload) return { setupRequired: true, posts: [] }

  const payload = await getPayload({ config })
  const response = await payload.find({
    collection: 'posts',
    depth: 1,
    draft: false,
    overrideAccess: false,
    limit: 20,
    sort: '-publishedAt',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { publishedAt: { less_than_equal: new Date().toISOString() } },
      ],
    },
  })

  return {
    setupRequired: false,
    posts: response.docs.map(toPublishedPost),
  }
}

export async function getPublishedPost(slug: string): Promise<CmsPostResult> {
  if (!featureState().payload) return { setupRequired: true, post: null }

  const payload = await getPayload({ config })
  const response = await payload.find({
    collection: 'posts',
    depth: 2,
    draft: false,
    overrideAccess: false,
    limit: 1,
    where: {
      and: [
        { slug: { equals: slug } },
        { _status: { equals: 'published' } },
        { publishedAt: { less_than_equal: new Date().toISOString() } },
      ],
    },
  })

  return {
    setupRequired: false,
    post: response.docs[0] ? toPublishedPost(response.docs[0]) : null,
  }
}

function toPublishedPost(doc: any): PublishedPost {
  return {
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary,
    publishedAt: doc.publishedAt ?? null,
    content: doc.content ?? null,
    cover: {
      url: typeof doc.coverImage === 'object' ? doc.coverImage?.url ?? null : null,
      alt: doc.coverAlt ?? (typeof doc.coverImage === 'object' ? doc.coverImage?.alt ?? null : null),
    },
    updatedAt: doc.updatedAt ?? null,
    canonicalUrl: doc.canonicalUrl ?? null,
    socialImage: typeof doc.socialImage === 'object' ? doc.socialImage?.url ?? null : null,
    seoTitle: doc.seoTitle ?? null,
    seoDescription: doc.seoDescription ?? null,
  }
}

/** Resolve only owner-authored internal blog paths; never redirect to another origin. */
export async function getBlogRedirect(slug: string) {
  if (!featureState().payload) return null
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'redirects', limit: 1, depth: 0, overrideAccess: true, where: { from: { equals: `/blog/${slug}` } } })
  const rule = result.docs[0]
  if (!rule || !/^\/blog\/[a-zA-Z0-9_-]+$/.test(rule.to) || rule.to === `/blog/${slug}`) return null
  return { to: rule.to, permanent: rule.permanent }
}

/** Sitemap retrieval is paginated independently from the journal's visible page. */
export async function getPublishedPostSitemapEntries() {
  if (!featureState().payload) return [];
  const payload = await getPayload({ config });
  const entries: { slug: string; updatedAt: string; canonicalUrl?: string | null }[] = [];
  let page = 1;
  for (;;) {
    const result = await payload.find({ collection: 'posts', depth: 0, draft: false, overrideAccess: false,
      page, limit: 500, sort: 'id', select: { slug: true, updatedAt: true, canonicalUrl: true },
      where: { and: [{ _status: { equals: 'published' } }, { publishedAt: { less_than_equal: new Date().toISOString() } }] },
    });
    for (const post of result.docs) entries.push({ slug: post.slug, updatedAt: post.updatedAt, canonicalUrl: post.canonicalUrl });
    if (!result.hasNextPage) break;
    page++;
  }
  return entries;
}
