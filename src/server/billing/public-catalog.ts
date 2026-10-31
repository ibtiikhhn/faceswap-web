import { usingWhop } from './whop/settings';
import { publicWhopCatalog } from './whop/catalog';
import { publicPaddleCatalog } from './paddle/catalog';
import type { PricingCatalog } from '@/lib/pricing-catalog';

/** Only public display fields cross the server/client boundary. */
export function publicBillingCatalog(): PricingCatalog {
  return usingWhop() ? publicWhopCatalog() : publicPaddleCatalog();
}
