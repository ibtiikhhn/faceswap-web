'use client';
import { useState } from 'react';
export default function GenerationPhoto({id,label,available}:{id:string|null;label:string;available:boolean}) {
  const [failed,setFailed]=useState(false);
  const url=id ? `/api/owners/saas/asset/${encodeURIComponent(id)}` : '';
  return <figure className="cms-saas__photo"><figcaption>{label}</figcaption>{id&&available&&!failed ?
    <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${label} photo for this generation`} loading="lazy" onError={()=>setFailed(true)}/><span>Open full image ↗</span></a>:
    <div className="cms-saas__missing"><span>◇</span><strong>{!id?'Not generated':failed?'Image unavailable':'Expired or deleted'}</strong><small>{!id?'No result was saved.':'The job record is retained; this photo is not available.'}</small></div>}</figure>;
}
