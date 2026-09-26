import { getPublicBillingCatalog } from "@/server/billing/catalog";
import { json } from "@/server/billing/http";

export const runtime = "nodejs";

export async function GET() {
  return json(getPublicBillingCatalog());
}
