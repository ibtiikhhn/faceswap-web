import { usingWhop } from '@/server/billing/whop/settings';
import { publicWhopCatalog } from '@/server/billing/whop/catalog';
import { publicPaddleCatalog } from '@/server/billing/paddle/catalog';
import { json } from '@/server/billing/http';
export const runtime = 'nodejs';
export async function GET() { return json(usingWhop()?publicWhopCatalog():publicPaddleCatalog()); }
