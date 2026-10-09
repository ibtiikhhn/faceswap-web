import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv } from '../src/server/env';
import { POST as checkout } from '../src/app/(frontend)/api/billing/checkout/route';
import { POST as credits } from '../src/app/(frontend)/api/billing/credits/route';
import { POST as portal } from '../src/app/(frontend)/api/billing/portal/route';
import { POST as webhook } from '../src/app/(frontend)/api/webhooks/stripe/route';
import { POST as upload } from '../src/app/api/uploads/route';
import { POST as swap } from '../src/app/api/swaps/route';
import { NextRequest } from 'next/server';

afterEach(() => vi.unstubAllEnvs());

describe('public launch controls', () => {
  it('rejects mock processing in production, but permits a closed studio', () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('SWAP_PROVIDER', 'mock');
    vi.stubEnv('SWAPS_ENABLED', 'true');
    expect(() => getEnv()).toThrow(/Mock face-swap/);
    vi.stubEnv('SWAPS_ENABLED', 'false');
    expect(getEnv().SWAPS_ENABLED).toBe('false');
  });
  it('allows real production processing only with configured result hosts', () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('FACE_SWAP_PROVIDER', 'external');
    vi.stubEnv('SWAP_PROVIDER', 'external');
    vi.stubEnv('SWAPS_ENABLED', 'true');
    vi.stubEnv('CUSTOM_SWAP_RESULT_HOSTS', '');
    expect(() => getEnv()).toThrow(/CUSTOM_SWAP_RESULT_HOSTS/);
    vi.stubEnv('CUSTOM_SWAP_RESULT_HOSTS', 'images.example.com');
    expect(getEnv().SWAP_PROVIDER).toBe('external');
  });
  it('blocks uploads and new jobs before parsing photos or accessing the database when closed', async () => {
    vi.stubEnv('APP_ENV', 'test');
    vi.stubEnv('SWAP_PROVIDER', 'mock');
    vi.stubEnv('SWAPS_ENABLED', 'false');
    for (const handler of [upload, swap]) {
      const response = await handler(new NextRequest('http://localhost/api/test', { method: 'POST' }));
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('swaps_disabled');
    }
  });
  it('keeps Stripe purchase, portal and webhook endpoints retired with old keys present', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_obsolete');
    for (const handler of [checkout, credits, portal]) {
      const response = await handler(new NextRequest('http://localhost/api/billing',{method:'POST'}));
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('billing_unavailable');
    }
    expect((await webhook()).status).toBe(410);
  });
});
