import { getObject } from '@/server/storage';
import { env } from '@/server/env';
import { customSwap, CustomSwapError } from './providers/custom';

export type ProviderSuccess = { status:'succeeded'; providerRequestId:string; resultBuffer:Buffer; contentType:'image/webp'; isMock:boolean };
export type ProviderFailure = { status:'failed'; providerRequestId:string; code:string; message:string };
export type ProviderResult = ProviderSuccess | ProviderFailure;
export async function runProviderSwap(input:{jobId:string;sourceKey:string;targetKey:string;mode:"mock"|"external"}):Promise<ProviderResult> {
  const settings=env();
  const [source,target]=await Promise.all([getObject(input.sourceKey),getObject(input.targetKey)]);
  const isMock=input.mode==='mock';
  if (!isMock && settings.SWAP_PROVIDER !== 'external') return {status:'failed',providerRequestId:`custom_${input.jobId}`,code:'provider_disabled',message:'External face processing is currently disabled. Please try again later.'};
  // The API has no remote job ID. This is a local correlation ID, not a resumable provider handle.
  const providerRequestId=`${isMock?'mock':'custom'}_${input.jobId}`;
  try {
    const resultBuffer=isMock?target:await customSwap({source,target,endpoint:settings.CUSTOM_SWAP_URL,resultHosts:settings.CUSTOM_SWAP_RESULT_HOSTS.split(',').map(host=>host.trim().toLowerCase()).filter(Boolean)});
    return {status:'succeeded',providerRequestId,resultBuffer,contentType:'image/webp',isMock};
  } catch(error) {
    if(error instanceof CustomSwapError)return {status:'failed',providerRequestId,code:error.code,message:error.message};
    throw error;
  }
}
