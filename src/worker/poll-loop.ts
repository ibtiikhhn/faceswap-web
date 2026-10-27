/** Independent, non-overlapping lane. Explicit false means idle; errors back off too. */
export function startPollLoop(task:()=>Promise<unknown>,intervalMs:number,onError:(error:unknown)=>void,options:{idleMs?:number}={}) {
 const idleMs=options.idleMs??intervalMs;
 if(!Number.isFinite(intervalMs)||intervalMs<100||!Number.isFinite(idleMs)||idleMs<intervalMs)throw new Error('Invalid worker polling intervals');
 let stopped=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let active:Promise<void>;
 async function tick() {
  let delay=intervalMs;
  try { if(await task()===false)delay=idleMs; } catch(error) { delay=idleMs;onError(error); }
  finally { if(!stopped)timer=setTimeout(()=>{active=tick();},delay); }
 }
 active=tick();
 return async()=>{stopped=true;if(timer)clearTimeout(timer);await active;};
}
