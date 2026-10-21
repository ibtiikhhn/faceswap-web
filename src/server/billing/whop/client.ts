import { WhopClient,WhopEnvironment } from '@whop/sdk';

export function whopSettings(){
 const environment=process.env.WHOP_ENVIRONMENT??'sandbox';
 if(!['sandbox','production'].includes(environment))throw new Error('WHOP_ENVIRONMENT must be sandbox or production.');
 const accountId=process.env.WHOP_ACCOUNT_ID??'';
 const token=process.env.WHOP_API_KEY??'';
 if(!/^biz_[a-zA-Z0-9]+$/.test(accountId)||!token)throw new Error('Set WHOP_ACCOUNT_ID and WHOP_API_KEY for the selected environment.');
 return {environment,accountId,token};
}
export function getWhop(){
 const settings=whopSettings();
 return new WhopClient({token:settings.token,environment:settings.environment==='sandbox'?WhopEnvironment.Sandbox:WhopEnvironment.Production,apiVersionDate:'2026-10-15-1',timeoutInSeconds:20,maxRetries:0});
}
