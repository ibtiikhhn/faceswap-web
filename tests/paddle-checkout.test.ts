import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { ApiError } from '@paddle/paddle-node-sdk';
const mocks=vi.hoisted(()=>({query:vi.fn(),create:vi.fn(),price:vi.fn()}));
vi.mock('@/server/db',()=>({getPool:()=>({query:mocks.query}),withTransaction:async (_:unknown,fn:(db:unknown)=>unknown)=>fn({query:mocks.query})}));
vi.mock('@/server/billing/paddle/api',()=>({
 requirePaddle:()=>({PADDLE_ENVIRONMENT:'sandbox',APP_URL:'https://swapthisface.com'}),
 paddleEnvironment:()=> 'sandbox',paddleCustomerColumn:()=> 'paddle_sandbox_customer_id',
 getPaddle:()=>({prices:{get:mocks.price},transactions:{create:mocks.create}}),
}));
import { createPaddleCheckout } from '@/server/billing/paddle/checkout';
beforeEach(()=>{
 vi.stubEnv('PADDLE_WEEKLY_PRICE_ID','pri_01m4enb3ks61ztns5nfvt7tqbf');
 mocks.query.mockReset();mocks.create.mockReset();mocks.price.mockReset();
 mocks.price.mockResolvedValue({status:'active',unitPrice:{amount:'799',currencyCode:'USD'},trialPeriod:null,billingCycle:{interval:'week',frequency:1}});
 mocks.query.mockImplementation(async(sql:string)=>({rows:sql.startsWith('insert into app.paddle_checkouts')?[{id:'checkout-intent'}]:sql.startsWith('select email,')?[{email:'test@example.com',paddle_customer_id:'ctm_test'}]:[]}));
 mocks.create.mockResolvedValue({id:'txn_test'});
});
afterEach(()=>vi.unstubAllEnvs());
describe('Paddle checkout creation',()=>{
 it('uses Paddle default payment link without the domain override rejected by sandbox',async()=>{
  await expect(createPaddleCheckout('user','weekly','subscription')).resolves.toEqual({url:'/checkout?transaction=txn_test'});
  expect(mocks.create).toHaveBeenCalledWith({items:[{priceId:'pri_01m4enb3ks61ztns5nfvt7tqbf',quantity:1}],customerId:'ctm_test',collectionMode:'automatic',customData:{checkout_id:'checkout-intent'}});
 });
 it('releases a rejected transaction request for another attempt',async()=>{
  mocks.create.mockRejectedValue(new ApiError({type:'request_error',code:'transaction_checkout_url_not_approved',detail:'Provider detail',documentation_url:''},null));
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(createPaddleCheckout('user','weekly','subscription')).rejects.toMatchObject({code:'checkout_failed'});
  expect(mocks.query.mock.calls.at(-1)?.[1]).toEqual(['checkout-intent','canceled']);
  log.mockRestore();
 });
 it('retains an uncertain timeout for reconciliation instead of allowing a duplicate',async()=>{
  mocks.create.mockRejectedValue(new Error('timeout'));
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(createPaddleCheckout('user','weekly','subscription')).rejects.toMatchObject({code:'checkout_review'});
  expect(mocks.query.mock.calls.at(-1)?.[1]).toEqual(['checkout-intent','review']);
  log.mockRestore();
 });
});
