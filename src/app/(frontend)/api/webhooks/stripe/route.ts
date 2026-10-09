import { errorJson } from "@/server/billing/http";

export const runtime = "nodejs";

export async function POST() {
  return errorJson("provider_retired", "This payment provider is no longer supported.", 410);
}
