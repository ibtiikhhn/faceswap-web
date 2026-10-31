import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PricingCards } from '../src/components/pricing';
import type { PricingCatalog } from '../src/lib/pricing-catalog';
import { publicWhopCatalog } from '../src/server/billing/whop/catalog';

vi.mock('../src/components/account-provider', () => ({ useAccount: () => ({ account: null, loading: true }) }));

describe('initial public pricing HTML', () => {
  it('renders the catalog before account data and client effects load', () => {
    const initialCatalog = publicWhopCatalog({ WHOP_BILLING_ENABLED: 'true', WHOP_API_KEY: 'test', WHOP_ACCOUNT_ID: 'test', WHOP_WEBHOOK_SECRET: 'test', WHOP_PRODUCT_ID: 'test', WHOP_WEEKLY_PLAN_ID: 'plan_weekly', WHOP_MONTHLY_PLAN_ID: 'plan_monthly', WHOP_PACK_200_PLAN_ID: 'plan_small', WHOP_PACK_1000_PLAN_ID: 'plan_large', WHOP_ENVIRONMENT: 'production' });
    const html = renderToStaticMarkup(createElement<{ packsOnly?: boolean; initialCatalog?: PricingCatalog }>(PricingCards, { initialCatalog }));
    expect(html).toContain('$7.99');
    expect(html).toContain('$19.99');
    expect(html).toContain('500 credits every 30 days');
    expect(html).toContain('$10.00');
    expect(html).not.toContain('Coming soon');
    expect(html).not.toContain('Purchases are not open yet');
    expect(html).not.toContain('plan_weekly');
    expect(html).not.toContain('WHOP_API_KEY');
  });
});
