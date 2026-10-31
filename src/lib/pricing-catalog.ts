export type PricingPlan = { code: string; name: string; interval: string | null; configured: boolean; includedCredits: number | null; amount?: number | null; unitAmount?: number | null; currency?: string | null };
export type PricingPack = { code: string; name: string; configured: boolean; credits: number | null; amount?: number | null; currency?: string | null };
export type PricingCatalog = { provider?: string; environment?: string; subscriptions: PricingPlan[]; creditPacks: PricingPack[] };
