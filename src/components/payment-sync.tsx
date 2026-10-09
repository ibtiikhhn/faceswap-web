'use client';
import { useEffect, useState } from 'react';
import { api } from './api-client';
import { useAccount } from './account-provider';

/** The redirect is not proof of payment: wait for our verified webhook settlement. */
export function PaymentSync() {
 const { refresh } = useAccount();
 const [message,setMessage]=useState('');
 const [retry,setRetry]=useState(0);
 const [waiting,setWaiting]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get('checkout')!=='success')return;
  const id=params.get('transaction');
  let disposed=false; let timer:ReturnType<typeof setTimeout>; let attempts=0;
  setWaiting(false);setMessage('Confirming your payment… Your credits will update automatically.');
  async function poll(){
   try {
    if(!id) { await refresh(); if(!disposed)setMessage('Your account has refreshed. If payment is still processing, check again shortly.'); return; }
    const result=await api<{state:string}>(`/api/billing/transaction?id=${encodeURIComponent(id)}`,{cache:'no-store'});
    if(disposed)return;
    await refresh();
    if(disposed)return;
    if(result.state==='completed'){setMessage('Payment confirmed. Your credits are ready to use.');return;}
    if(result.state==='canceled'){setMessage('This checkout was canceled. No credits were added.');return;}
   } catch { /* A temporary network failure must not be reported as a successful payment. */ }
   if(disposed)return;
   if(++attempts>=40){setMessage('Payment confirmation is taking longer than usual. You can check again below. Please don’t pay again.');setWaiting(true);return;}
   timer=setTimeout(poll,3000);
  }
  void poll();
  return()=>{disposed=true;clearTimeout(timer);};
 },[refresh,retry]);
 if(!message)return null;
 return <div className="inline-notice" role="status" aria-live="polite">{message}{waiting&&<button className="button button-outline" onClick={()=>setRetry(n=>n+1)}>Check payment status</button>}</div>;
}
