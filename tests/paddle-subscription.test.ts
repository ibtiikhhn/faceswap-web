import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(),get:vi.fn(),preview:vi.fn(),update:vi.fn(),cancel:vi.fn(),price:vi.fn()}));
vi.mock('@/server/db',()=>({getPool:()=>({query:m.query}),withTransaction:async(_:unknown,fn:(db:unknown)=>unknown)=>fn({query:m.query})}));
vi.mock('@/server/billing/paddle/api',()=>({requirePaddle:()=>({PADDLE_ENVIRONMENT:'sandbox'}),paddleCustomerColumn:()=> 'paddle_sandbox_customer_id',getPaddle:()=>({subscriptions:{get:m.get,previewUpdate:m.preview,update:m.update,cancel:m.cancel},prices:{get:m.price}})}));
import { managePaddleSubscription } from '@/server/billing/paddle/subscription';
const confirm={action:'upgrade',planCode:'monthly',updatedAt:'version1',maxDueNow:'1500',currency:'USD'};
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('PADDLE_WEEKLY_PRICE_ID','pri_week');vi.stubEnv('PADDLE_MONTHLY_PRICE_ID','pri_month');
 m.query.mockResolvedValue({rows:[{paddle_subscription_id:'sub_owned',customer_id:'ctm_owned'}]});
 m.get.mockResolvedValue({id:'sub_owned',customerId:'ctm_owned',status:'active',collectionMode:'automatic',updatedAt:'version1',items:[{price:{id:'pri_week'},quantity:1}]});
 m.price.mockResolvedValue({status:'active',unitPrice:{amount:'1999',currencyCode:'USD'},billingCycle:{interval:'month',frequency:1}});
 m.preview.mockResolvedValue({updateSummary:{result:{action:'charge',amount:'1500'}},recurringTransactionDetails:{totals:{total:'1999'}},currencyCode:'USD',nextBilledAt:'2026-11-01'});
 m.cancel.mockResolvedValue({scheduledChange:{effectiveAt:'2026-11-01'}});
});
afterEach(()=>vi.unstubAllEnvs());
describe('owned Paddle subscription management',()=>{
 it('previews without mutating billing and limits queries to the owner and environment',async()=>{
  const quote=await managePaddleSubscription('user',{action:'preview',planCode:'monthly'});
  expect(quote).toMatchObject({dueNow:'1500',recurring:'1999'});expect(m.update).not.toHaveBeenCalled();
  expect(m.query.mock.calls[1][1]).toEqual(['user','sandbox']);
 });
 it('confirms a prorated upgrade with payment failure prevention and no optimistic grants',async()=>{
  await managePaddleSubscription('user',confirm);
  expect(m.update).toHaveBeenCalledWith('sub_owned',{items:[{priceId:'pri_month',quantity:1}],prorationBillingMode:'prorated_immediately',onPaymentFailure:'prevent_change'});
  expect(m.query.mock.calls.every(([sql])=>sql.startsWith('select'))).toBe(true);
 });
 it('rejects stale or increased quotes without charging',async()=>{
  await expect(managePaddleSubscription('user',{...confirm,maxDueNow:'1499'})).rejects.toMatchObject({status:409});
  await expect(managePaddleSubscription('user',{...confirm,updatedAt:'old'})).rejects.toMatchObject({status:409});
  expect(m.update).not.toHaveBeenCalled();
 });
 it('checks remote customer ownership before any mutation',async()=>{
  m.get.mockResolvedValue({customerId:'ctm_other'});
  await expect(managePaddleSubscription('user',{action:'cancel'})).rejects.toMatchObject({status:403});expect(m.cancel).not.toHaveBeenCalled();
 });
 it('cancels only at the end of the billing period',async()=>{
  await expect(managePaddleSubscription('user',{action:'cancel'})).resolves.toEqual({endsAt:'2026-11-01'});
  expect(m.cancel).toHaveBeenCalledWith('sub_owned',{effectiveFrom:'next_billing_period'});
 });
 it('rejects attempts to upgrade an already monthly subscription',async()=>{
  m.get.mockResolvedValue({customerId:'ctm_owned',status:'active',collectionMode:'automatic',items:[{price:{id:'pri_month'},quantity:1}]});
  await expect(managePaddleSubscription('user',confirm)).rejects.toMatchObject({status:409});expect(m.update).not.toHaveBeenCalled();
 });
});
