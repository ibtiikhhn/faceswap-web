'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ArrowUpRight, LoaderCircle, CircleAlert, Zap } from './icons';
import { api, ApiError, errorMessage } from './api-client';

type Plan={code:string;name:string;interval:string;configured:boolean;includedCredits:number|null;amount?:number|null;unitAmount?:number|null;currency?:string|null};
type Pack={code:string;name:string;configured:boolean;credits:number|null;amount?:number|null;currency?:string|null};
type Catalog={subscriptions:Plan[];creditPacks:Pack[]};
const defaults:Plan[]=[{code:'weekly',name:'Weekly',interval:'week',configured:false,includedCredits:null},{code:'monthly',name:'Monthly',interval:'month',configured:false,includedCredits:null},{code:'yearly',name:'Yearly',interval:'year',configured:false,includedCredits:null}];
const descriptions:Record<string,string>={weekly:'For a little creative adventure.',monthly:'Make room for more possibilities.',yearly:'A full year of fresh perspectives.'};
export function PricingCards(){
 const [catalog,setCatalog]=useState<Catalog>({subscriptions:defaults,creditPacks:[]});const [busy,setBusy]=useState('');const [error,setError]=useState('');
 useEffect(()=>{api<Catalog>('/api/billing/plans').then(setCatalog).catch(e=>setError(errorMessage(e)));},[]);
 async function checkout(code:string,kind:'plan'|'pack'){
  setBusy(code);setError('');try{const data=await api<{url:string}>(kind==='plan'?'/api/billing/checkout':'/api/billing/credits',{method:'POST',body:JSON.stringify(kind==='plan'?{planCode:code}:{packCode:code})});window.location.assign(data.url);}catch(e){if(e instanceof ApiError&&e.status===401){window.location.assign('/login?next=/pricing');return;}setError(errorMessage(e));}finally{setBusy('');}
 }
 const hasLivePlans=catalog.subscriptions.some(plan=>plan.configured);
 return <><div className="pricing-grid">{catalog.subscriptions.map(plan=>{
 const amount=plan.unitAmount??plan.amount;const formatted=amount!=null&&plan.currency?new Intl.NumberFormat('en',{style:'currency',currency:plan.currency}).format(amount/100):null;
 return <article key={plan.code} className={`price-card ${plan.code==='monthly'?'featured':''}`}>{plan.code==='monthly'&&<span className="plan-badge">A LITTLE EVERY MONTH</span>}<h2>{plan.name}</h2><p>{descriptions[plan.code]}</p><div className={`price-amount ${formatted?'':'unset'}`}>{formatted??(plan.configured?'See checkout':'Coming soon')}{formatted&&<small>/{plan.interval}</small>}</div><p>{plan.configured&&plan.includedCredits!=null?`${plan.includedCredits} credits every ${plan.interval}`:'Prices and credit allowances to be announced'}</p><ul><li><Check/>Single-face photo swaps</li><li><Check/>Private photos and saved history</li><li><Check/>Download your results</li><li><Check/>Buy extra credits when you need them</li><li><Check/>Cancel future renewals anytime</li></ul><button onClick={()=>checkout(plan.code,'plan')} disabled={!plan.configured||Boolean(busy)} className={`button button-full ${plan.code==='monthly'?'button-lime':'button-outline'}`}>{busy===plan.code?<LoaderCircle size={15} className="spin"/>:<ArrowUpRight size={15}/>} {plan.configured?`Choose ${plan.name.toLowerCase()}`:'Not available yet'}</button></article>;
 })}</div><p className="pricing-footnote">One credit per successful swap. Failed swaps release your credit.<br/>{!hasLivePlans?'Paid plans are not open yet. Pricing will be published here when billing is configured.':'Subscriptions renew automatically. Manage or cancel future renewals from your billing page.'}</p>
 {error&&<div role="alert" className="inline-notice"><CircleAlert size={14} style={{verticalAlign:'middle',marginRight:7}}/>{error}</div>}
 <div className="credit-pack"><div><h3>A little extra inspiration?</h3><p>Subscribers can top up with extra credits. Purchased credits stay on your account;<br className="desktop-break"/> an active subscription is required to use them.</p></div>{catalog.creditPacks.some(pack=>pack.configured)?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{catalog.creditPacks.filter(pack=>pack.configured).map(pack=><button key={pack.code} className="button button-outline" disabled={Boolean(busy)} onClick={()=>checkout(pack.code,'pack')}><Zap size={14}/>{busy===pack.code?'Opening…':`${pack.credits} credits`}</button>)}</div>:<span className="tiny-tag"><Zap size={12}/>CREDIT PACKS COMING SOON</span>}</div></>;
}
