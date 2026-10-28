import type { Metadata } from 'next';

export const siteName = 'SwapThisFace';
export function siteOrigin() {
  return new URL(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin;
}
export function publicIndexingEnabled() {
  const url = new URL(siteOrigin());
  return process.env.APP_ENV === 'production' && ['swapthisface.com', 'www.swapthisface.com'].includes(url.hostname);
}
export function absoluteUrl(path: string) { return new URL(path, `${siteOrigin()}/`).href; }
export function httpUrl(value: string | null | undefined) {
  if (!value?.trim()) return undefined;
  try { const url = new URL(value, `${siteOrigin()}/`); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = absoluteUrl(path);
  // Keep editorial titles intact; the site name is supplied separately.
  const fullTitle = title;
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: url },
    openGraph: { type: 'website', siteName, title: fullTitle, description, url, images: [{url:absoluteUrl('/social-preview.png'),width:1200,height:630,alt:'SwapThisFace.com — Recreate a photo with your face'}] },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [absoluteUrl('/social-preview.png')] },
  };
}
export function serializeJsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
