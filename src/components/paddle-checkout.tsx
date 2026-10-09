'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PricingCards } from './pricing';
import { initializePaddle } from '@paddle/paddle-js';
import { api, errorMessage } from './api-client';
let initialized: ReturnType<typeof initializePaddle> | undefined;
export function PaddleCheckout(){
 const [message,setMessage]=useState('Opening secure checkout…');
 const [error,setError]=useState('');
 const [chooseOffer,setChooseOffer]=useState(false);
 useEffect(()=>{
  let disposed=false;
  const params=new URLSearchParams(window.location.search);
  const id=params.get('transaction')??params.get('_ptxn');
  if(!id){setChooseOffer(true);setMessage('Choose a plan or credit pack to start checkout.');return;}
  api<{transactionId:string;state:string;token:string;environment:'sandbox'|'production'}>(`/api/billing/transaction?id=${encodeURIComponent(id)}`).then(async data=>{
   if(disposed)return;
   if(data.state==='completed'){setMessage('Payment confirmed. Your credits are ready.');return;}
   if(data.state!=='ready')throw new Error('This checkout is unavailable. Contact support for help.');
   initialized??=initializePaddle({token:data.token,environment:data.environment});
   const paddle=await initialized;
   if(!paddle)throw new Error('Checkout could not load. Please refresh and try again.');
   if(disposed)return;
   paddle.Checkout.open({transactionId:data.transactionId,settings:{displayMode:'overlay',variant:'one-page',allowLogout:false,successUrl:window.location.origin+'/dashboard/billing?checkout=success'}});
   setMessage(data.environment==='sandbox'?'Sandbox checkout — test payments only.':'Complete your payment in the secure checkout window.');
  }).catch(e=>{if(!disposed)setError(errorMessage(e));});
  return()=>{disposed=true;};
 },[]);
 if(chooseOffer)return <main className="wrap"><div className="page-header"><h1>Choose your swaps</h1><p>{message}</p></div><PricingCards/></main>;
 return <main className="wrap"><div className="page-header"><h1>Secure checkout</h1><p role="status">{message}</p>{error&&<p role="alert">{error}</p>}<p>Credits appear after payment confirmation. This can take a few moments.</p><Link href="/dashboard/billing" className="button button-outline">View my credits</Link> <Link href="/pricing" className="text-link">Back to pricing</Link></div></main>;
}
