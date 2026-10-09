export const offers = [
  { code: 'weekly', kind: 'subscription', name: 'Weekly', interval: 'week', amount: 799, credits: 100, priceEnv: 'PADDLE_WEEKLY_PRICE_ID' },
  { code: 'monthly', kind: 'subscription', name: 'Monthly', interval: 'month', amount: 1999, credits: 500, priceEnv: 'PADDLE_MONTHLY_PRICE_ID' },
  { code: 'small', kind: 'pack', name: '200 swaps', interval: null, amount: 1000, credits: 200, priceEnv: 'PADDLE_PACK_200_PRICE_ID' },
  { code: 'large', kind: 'pack', name: '1,000 swaps', interval: null, amount: 5000, credits: 1000, priceEnv: 'PADDLE_PACK_1000_PRICE_ID' },
] as const;
export type Offer = typeof offers[number];
export function paddleReady(env: Record<string,string|undefined> = process.env) {
  return env.PADDLE_BILLING_ENABLED === 'true' && Boolean((env.PADDLE_API_KEY || (env.PADDLE_ENVIRONMENT !== "production" && env.PADDLE_SANDBOX_API_KEY)) && env.PADDLE_CLIENT_TOKEN && env.PADDLE_WEBHOOK_SECRET);
}
export function publicPaddleCatalog(env: Record<string,string|undefined> = process.env) {
  const configured = (o: Offer) => paddleReady(env) && /^pri_[a-z0-9]{26}$/.test(env[o.priceEnv] ?? '');
  return {
    environment: env.PADDLE_ENVIRONMENT ?? 'sandbox',
    subscriptions: offers.filter(o => o.kind === 'subscription').map(o => ({code:o.code,name:o.name,interval:o.interval,amount:o.amount,currency:'USD',includedCredits:o.credits,configured:configured(o)})),
    creditPacks: offers.filter(o => o.kind === 'pack').map(o => ({code:o.code,name:o.name,amount:o.amount,currency:'USD',credits:o.credits,configured:configured(o)})),
  };
}
