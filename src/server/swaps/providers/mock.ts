import { nanoid } from 'nanoid'
import type { SwapProvider } from './types'

export const mockSwapProvider: SwapProvider = {
  async submitSwap(input) {
    return {
      providerRequestId: `mock_${nanoid(12)}`,
      state: 'succeeded',
      resultKey: `mock-results/${input.jobId}.txt`,
    }
  },
  async getSwapStatus(providerRequestId) {
    return {
      providerRequestId,
      state: 'succeeded',
      resultKey: `mock-results/${providerRequestId}.txt`,
    }
  },
}
