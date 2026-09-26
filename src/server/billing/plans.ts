import { env } from '@/server/env'

export type BillingPlanCode = 'weekly' | 'monthly' | 'yearly'

export const planDefaults: Record<BillingPlanCode, { label: string; interval: string; credits: number }> = {
  weekly: { label: 'Weekly', interval: 'week', credits: 10 },
  monthly: { label: 'Monthly', interval: 'month', credits: 60 },
  yearly: { label: 'Yearly', interval: 'year', credits: 900 },
}

export function configuredPriceId(code: BillingPlanCode) {
  const parsed = env()
  if (code === 'weekly') return parsed.STRIPE_WEEKLY_PRICE_ID
  if (code === 'monthly') return parsed.STRIPE_MONTHLY_PRICE_ID
  return parsed.STRIPE_YEARLY_PRICE_ID
}

export function listPublicPlans() {
  return (Object.keys(planDefaults) as BillingPlanCode[]).map((code) => ({
    code,
    ...planDefaults[code],
    configured: Boolean(configuredPriceId(code)),
  }))
}
