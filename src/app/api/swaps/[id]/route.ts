import { NextRequest } from "next/server";
import { getPool } from "@/server/db";
import { getActor } from "@/server/auth";
import { config503, fail, json } from "@/server/http";
import { featureState } from "@/server/env";
import { formatSwapJob, getSwap } from "@/server/swaps/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!featureState().database) return config503("Database");
    const { id } = await params;
    const actor = await getActor(request);
    const swap = await getSwap(getPool(), id, actor);
    const job = formatSwapJob(swap as any);
    return json({ job, swap: { ...(swap as any), status: (swap as any).state } });
  } catch (error) {
    return fail(error);
  }
}
