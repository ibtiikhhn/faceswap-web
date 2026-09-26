export type SwapSubmitInput = {
  jobId: string
  sourceAssetKey: string
  targetAssetKey: string
}

export type SwapSubmitResult = {
  providerRequestId: string
  state: 'processing' | 'succeeded' | 'failed'
  resultKey?: string
  errorCode?: string
  errorMessage?: string
}

export interface SwapProvider {
  submitSwap(input: SwapSubmitInput): Promise<SwapSubmitResult>
  getSwapStatus(providerRequestId: string): Promise<SwapSubmitResult>
  cancelSwap?(providerRequestId: string): Promise<void>
}
