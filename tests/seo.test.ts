import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpUrl, pageMetadata, publicIndexingEnabled, serializeJsonLd } from '../src/lib/seo';
afterEach(() => vi.unstubAllEnvs());
describe('search metadata safeguards', () => {
  it('keeps staging noindex even if the environment is accidentally production', () => {
    vi.stubEnv('APP_ENV', 'production'); vi.stubEnv('APP_URL', 'https://staging.swapthisface.com');
    expect(publicIndexingEnabled()).toBe(false);
    vi.stubEnv('APP_URL', 'https://swapthisface.com'); expect(publicIndexingEnabled()).toBe(true);
    vi.stubEnv('APP_ENV', 'staging'); expect(publicIndexingEnabled()).toBe(false);
  });
  it('uses each page URL rather than a shared home canonical', () => {
    vi.stubEnv('APP_URL', 'https://swapthisface.com/');
    const metadata = pageMetadata('Editor', 'Upload two photos.', '/face-swap');
    expect(metadata.title).toEqual({ absolute: 'Editor · SwapThisFace.com' });
    expect(metadata.alternates?.canonical).toBe('https://swapthisface.com/face-swap');
    expect(metadata.openGraph?.url).toBe('https://swapthisface.com/face-swap');
  });
  it('rejects unsafe CMS URL schemes and escapes script-closing article titles', () => {
    expect(httpUrl('javascript:alert(1)')).toBeUndefined();
    expect(httpUrl('data:text/html,test')).toBeUndefined();
    const title = '</script><script>alert(1)</script>';
    const serialized = serializeJsonLd({ headline: title });
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized).headline).toBe(title);
  });
});
