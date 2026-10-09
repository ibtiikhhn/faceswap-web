import sharp from 'sharp';
import { setTimeout as sleep } from 'node:timers/promises';
import { downloadResult } from './result-download';

export class CustomSwapError extends Error {
  constructor(public code: string, message: string) { super(message); this.name='CustomSwapError'; }
}
const MAX_PIXELS = 40_000_000;
const attempts = 3;
export type CustomDependencies = {
  fetch: typeof fetch;
  download: typeof downloadResult;
  pause: (ms:number) => Promise<unknown>;
};
const defaults: CustomDependencies = { fetch: globalThis.fetch, download: downloadResult, pause: sleep };
async function backoff(attempt:number, deps:CustomDependencies) { await deps.pause(1000 * 2 ** attempt + Math.floor(Math.random()*500)); }
async function readJson(response:Response) {
  if (!response.body) throw new Error('Empty response');
  const reader=response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  try { for (;;) { const part=await reader.read(); if(part.done)break; size+=part.value.length; if(size>64*1024)throw new Error('Response too large'); chunks.push(part.value); } }
  finally { await reader.cancel().catch(()=>undefined); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function jpeg(buffer:Buffer) {
  return sharp(buffer,{limitInputPixels:MAX_PIXELS,failOn:'error'}).rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:80}).toBuffer();
}
export async function customSwap(input:{source:Buffer;target:Buffer;endpoint:string;resultHosts:string[]}, deps:CustomDependencies=defaults):Promise<Buffer> {
  if(!input.resultHosts.length)throw new CustomSwapError('provider_not_configured','Face-swap result storage is not configured yet.');
  const endpoint=new URL(input.endpoint);
  if(endpoint.protocol!=='https:' || endpoint.username || endpoint.password)throw new CustomSwapError('provider_not_configured','The face-swap endpoint must use HTTPS.');
  let source:Buffer,target:Buffer;
  try { [source,target]=await Promise.all([jpeg(input.source),jpeg(input.target)]); }
  catch { throw new CustomSwapError('invalid_provider_input','One of the photos could not be prepared. Choose another image.'); }
  let resultUrl:string|undefined;
  for(let attempt=0;attempt<attempts;attempt++) {
    const form=new FormData();
    form.append('source_image',new Blob([new Uint8Array(source)],{type:'image/jpeg'}),'source.jpg');
    form.append('target_image',new Blob([new Uint8Array(target)],{type:'image/jpeg'}),'target.jpg');
    let response:Response;
    try { response=await deps.fetch(endpoint,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(120_000)}); }
    catch {
      if(attempt<attempts-1){await backoff(attempt,deps);continue;}
      throw new CustomSwapError('provider_network_error','The face-swap service could not be reached. Please try again later.');
    }
    if(response.status===429 || response.status===503) {
      await response.body?.cancel().catch(()=>undefined);
      if(attempt<attempts-1){await backoff(attempt,deps);continue;}
      throw new CustomSwapError('provider_busy','The face-swap service is busy. Please try again later.');
    }
    if(!response.ok) {
      // Never expose arbitrary provider response text (which may contain URLs or credentials).
      await response.body?.cancel().catch(()=>undefined);
      throw new CustomSwapError('provider_rejected','The face-swap service could not process these photos. Try clear photos with one visible face each.');
    }
    try {
      const body=await readJson(response);
      const output=body?.external_api_response?.output;
      if(!Array.isArray(output) || typeof output[0]!=='string' || !output[0])throw new Error('Missing output');
      resultUrl=output[0];
    } catch { throw new CustomSwapError('provider_invalid_response','The face-swap service returned an invalid result. Please try again.'); }
    break;
  }
  if(!resultUrl)throw new CustomSwapError('provider_invalid_response','No result was returned.');
  // Retry only the download once a result exists; never resubmit the photos for a download failure.
  let downloaded:Buffer|undefined;
  for(let attempt=0;attempt<attempts;attempt++) {
    try { downloaded=await deps.download(resultUrl,input.resultHosts); break; }
    catch { if(attempt<attempts-1){await backoff(attempt,deps);continue;} throw new CustomSwapError('provider_download_failed','The generated photo could not be downloaded. Please try again later.'); }
  }
  try {
    const image=sharp(downloaded!,{limitInputPixels:MAX_PIXELS,failOn:'error'});
    const metadata=await image.metadata();
    if(!metadata.width || !metadata.height || !['jpeg','png','webp'].includes(metadata.format??'') || (metadata.pages??1)>1)throw new Error('Invalid image');
    return await image.rotate().webp({quality:92}).toBuffer();
  } catch { throw new CustomSwapError('provider_invalid_image','The face-swap service returned an unreadable image. Please try again.'); }
}
