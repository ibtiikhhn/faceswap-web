import { describe,it,expect,vi,afterEach } from 'vitest';
import { ApiError,type Paddle } from '@paddle/paddle-node-sdk';
import { checkoutFailureState,providerErrorCode,recoverPaddleCheckout } from '@/server/billing/paddle/recovery';
import type { DbClient } from '@/server/db';
const rejected=()=>new ApiError({type:'request_error',code:'transaction_checkout_url_not_approved',detail:'sensitive detail',documentation_url:''},null);
function fixture(pages:unknown[][]){
 const query=vi.fn().mockResolvedValueOnce({rows:[{id:'intent',price_id:'pri_test',created_at:new Date(0)}]}).mockResolvedValueOnce({rows:[{customer_id:'ctm_test'}]}).mockResolvedValue({rows:[]});
 let position=0;
 const collection={hasMore:true,next:vi.fn(async()=>{const p=pages[position++];collection.hasMore=position<pages.length;return p;})};
 const list=vi.fn(()=>collection);
 return {query,collection,list,db:{query} as DbClient,paddle:{transactions:{list}} as unknown as Pick<Paddle,'transactions'>};
}
afterEach(()=>vi.unstubAllEnvs());
describe('checkout recovery',()=>{
 it('releases explicit request failures but preserves ambiguous transaction outcomes',()=>{
  expect(checkoutFailureState(rejected(),'transaction')).toBe('canceled');
  expect(checkoutFailureState(new Error('timeout'),'transaction')).toBe('review');
  expect(checkoutFailureState(new Error('database error'),'persist')).toBe('review');
  expect(checkoutFailureState(new Error('lookup failed'),'customer')).toBe('canceled');
  expect(providerErrorCode(rejected())).toBe('transaction_checkout_url_not_approved');
  expect(providerErrorCode(new Error('secret'))).toBeUndefined();
 });
 it('releases a failed intent only after examining all customer transaction pages',async()=>{
  const f=fixture([[{id:'unrelated',customData:{checkout_id:'other'}}],[]]);
  await recoverPaddleCheckout(f.db,f.paddle,'user');
  expect(f.collection.next).toHaveBeenCalledTimes(2);
  expect(f.list).toHaveBeenCalledWith({customerId:['ctm_test'],perPage:30});
  expect(f.query.mock.calls.at(-1)?.[0]).toContain("set state='canceled'");
 });
 it('recovers a remote draft whose original response was lost',async()=>{
  const f=fixture([[{id:'txn_test',customerId:'ctm_test',customData:{checkout_id:'intent'},status:'draft',items:[{price:{id:'pri_test'},quantity:1}]}]]);
  await recoverPaddleCheckout(f.db,f.paddle,'user');
  expect(f.query.mock.calls.at(-1)?.[1]).toEqual(['intent','txn_test']);
  expect(f.query.mock.calls.at(-1)?.[0]).toContain("state='ready'");
 });
 it('keeps a completed payment bound instead of releasing it for another charge',async()=>{
  const f=fixture([[{id:'txn_test',customerId:'ctm_test',customData:{checkout_id:'intent'},status:'completed',items:[{price:{id:'pri_test'},quantity:1}]}]]);
  await expect(recoverPaddleCheckout(f.db,f.paddle,'user')).rejects.toMatchObject({code:'payment_processing'});
  expect(f.query.mock.calls.at(-1)?.[1]).toEqual(['intent','txn_test']);
 });
 it('does not release anything if the provider lookup fails',async()=>{
  const f=fixture([]);f.collection.next.mockRejectedValueOnce(new Error('offline'));
  await expect(recoverPaddleCheckout(f.db,f.paddle,'user')).rejects.toThrow('offline');
  expect(f.query).toHaveBeenCalledTimes(2);
 });
 it('rejects a recovered transaction with a different price',async()=>{
  const f=fixture([[{id:'txn_test',customerId:'ctm_test',customData:{checkout_id:'intent'},status:'draft',items:[{price:{id:'wrong'},quantity:1}]}]]);
  await expect(recoverPaddleCheckout(f.db,f.paddle,'user')).rejects.toMatchObject({code:'checkout_review'});
  expect(f.query).toHaveBeenCalledTimes(2);
 });
});
