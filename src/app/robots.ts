import type { MetadataRoute } from 'next';
import { absoluteUrl, publicIndexingEnabled } from '@/lib/seo';
export default function robots(): MetadataRoute.Robots {
  // Public pages remain crawlable so crawlers can read staging's noindex metadata.
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] },
    ...(publicIndexingEnabled() ? { sitemap: absoluteUrl('/sitemap.xml') } : {}) };
}
