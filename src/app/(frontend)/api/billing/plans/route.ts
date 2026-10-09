import { publicPaddleCatalog } from '@/server/billing/paddle/catalog';
import { json } from '@/server/billing/http';
export const runtime = 'nodejs';
export async function GET() { return json(publicPaddleCatalog()); }
