import { getObject } from "@/server/storage";
import { env } from "@/server/env";
import { mockSwapProvider } from "./providers/mock";

export type ProviderSuccess = {
  status: "succeeded";
  providerRequestId: string;
  resultBuffer: Buffer;
  contentType: "image/webp";
};

export type ProviderFailure = {
  status: "failed";
  providerRequestId: string;
  code: string;
  message: string;
};

export type ProviderResult = ProviderSuccess | ProviderFailure;

export async function runProviderSwap(input: { jobId: string; sourceKey: string; targetKey: string }): Promise<ProviderResult> {
  if (env().SWAP_PROVIDER !== "mock") {
    throw new Error("External face-swap adapter is reserved for the final provider stage.");
  }
  const target = await getObject(input.targetKey);
  await getObject(input.sourceKey);
  return {
    status: "succeeded",
    providerRequestId: `mock_${input.jobId}`,
    resultBuffer: target,
    contentType: "image/webp"
  };
}

export function getSwapProvider() {
  if (env().SWAP_PROVIDER !== "mock") {
    throw new Error("External face-swap adapter is reserved for the final provider stage.");
  }
  return mockSwapProvider;
}
