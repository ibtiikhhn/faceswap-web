import type { Metadata } from 'next';

export const siteName = 'SwapThisFace.com';
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
  const fullTitle = `${title} · ${siteName}`;
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: url },
    openGraph: { type: 'website', siteName, title: fullTitle, description, url },
    twitter: { card: 'summary', title: fullTitle, description },
  };
}
export function serializeJsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
