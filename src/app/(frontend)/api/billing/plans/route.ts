import { publicBillingCatalog } from '@/server/billing/public-catalog';
import { json } from '@/server/billing/http';
export const runtime = 'nodejs';
export async function GET() { return json(publicBillingCatalog()); }
