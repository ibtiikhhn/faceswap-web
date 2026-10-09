import { getPool, withTransaction } from '@/server/db';
import { HttpError } from '@/server/http';
import { getPaddle, requirePaddle, paddleCustomerColumn } from './api';
import { offers } from './catalog';

export async function createPaddleCheckout(userId: string, code: string, kind: 'subscription' | 'pack') {
  const settings = requirePaddle();
  const offer = offers.find(o => o.code === code && o.kind === kind);
  if (!offer) throw new HttpError(400, 'Choose a valid offer.', 'invalid_offer');
  const priceId = process.env[offer.priceEnv];
  if (!priceId || !/^pri_[a-z0-9]{26}$/.test(priceId)) throw new HttpError(503, 'This offer is not configured.', 'billing_unavailable');
  const paddle = getPaddle();
  const price = await paddle.prices.get(priceId);
  if (price.status !== 'active' || price.unitPrice.amount !== String(offer.amount) || price.unitPrice.currencyCode !== 'USD' || price.trialPeriod || (price.billingCycle?.interval ?? null) !== offer.interval || (price.billingCycle && price.billingCycle.frequency !== 1)) {
    throw new HttpError(503, 'This offer needs configuration review.', 'billing_unavailable');
  }
  const pool = getPool();
  const intent = await withTransaction(pool, async tx => {
    await tx.query('select id from app.users where id=$1 for update', [userId]);
    if (kind === 'subscription') {
      const active = await tx.query("select id from app.subscriptions where user_id=$1 and paddle_environment=$2 and status in ('active','trialing','past_due','paused') limit 1", [userId,settings.PADDLE_ENVIRONMENT]);
      if (active.rows.length) throw new HttpError(409, 'Manage your existing subscription from your billing page.', 'subscription_exists');
    }
    const existing = await tx.query<{id:string;code:string;state:string;transaction_id:string|null}>("select * from app.paddle_checkouts where user_id=$1 and environment=$2 and state in ('creating','ready','review')",[userId,settings.PADDLE_ENVIRONMENT]);
    if (existing.rows[0]) {
      const row=existing.rows[0];
      if(row.code===code && row.state==='ready' && row.transaction_id) return {id:row.id,transactionId:row.transaction_id};
      throw new HttpError(409, 'A checkout is already pending. Finish it or contact support before starting another.', 'checkout_pending');
    }
    const inserted=await tx.query<{id:string}>('insert into app.paddle_checkouts(user_id,kind,code,price_id,credits,environment) values($1,$2,$3,$4,$5,$6) returning id',[userId,kind,code,priceId,offer.credits,settings.PADDLE_ENVIRONMENT]);
    return {id:inserted.rows[0].id,transactionId:null};
  });
  if (intent.transactionId) return {url:`/checkout?transaction=${encodeURIComponent(intent.transactionId)}`};
  try {
    const user=(await pool.query<{email:string;paddle_customer_id:string|null}>(`select email,${paddleCustomerColumn()} as paddle_customer_id from app.users where id=$1`,[userId])).rows[0];
    let customerId=user.paddle_customer_id;
    if(!customerId) {
      const matches=await paddle.customers.list({email:[user.email]}).next();
      const customer=matches.find(c=>c.email===user.email && c.status==='active') ?? await paddle.customers.create({email:user.email});
      customerId=customer.id;
      await pool.query(`update app.users set ${paddleCustomerColumn()}=$2 where id=$1`,[userId,customerId]);
    }
    const transaction=await paddle.transactions.create({items:[{priceId,quantity:1}],customerId,collectionMode:'automatic',customData:{checkout_id:intent.id},checkout:{url:new URL('/checkout',settings.APP_URL).toString()}});
    await pool.query("update app.paddle_checkouts set transaction_id=$2,state='ready' where id=$1",[intent.id,transaction.id]);
    return {url:`/checkout?transaction=${encodeURIComponent(transaction.id)}`};
  } catch {
    // A timeout may hide a successful remote creation. Never retry blindly.
    await pool.query("update app.paddle_checkouts set state='review' where id=$1 and state='creating'",[intent.id]);
    throw new HttpError(502,'Checkout could not be opened. Please contact support if the problem persists.','checkout_review');
  }
}
