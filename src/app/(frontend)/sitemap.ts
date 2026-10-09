import type { MetadataRoute } from 'next';
import { getPublishedPostSitemapEntries } from '@/server/cms';
import { absoluteUrl, httpUrl, publicIndexingEnabled } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!publicIndexingEnabled()) return [];
  const posts = await getPublishedPostSitemapEntries();
  return [
    ...['/', '/face-swap', '/pricing', '/blog', '/privacy', '/terms', '/refunds'].map(path => ({ url: absoluteUrl(path) })),
    ...posts.flatMap(post => {
      const url = absoluteUrl(`/blog/${encodeURIComponent(post.slug)}`);
      const canonical = httpUrl(post.canonicalUrl);
      if (canonical && canonical !== url) return [];
      return [{ url, lastModified: new Date(post.updatedAt) }];
    }),
  ];
}
