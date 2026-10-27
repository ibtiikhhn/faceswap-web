/** Independent, non-overlapping lane. Startup and later failures both retry. */
export function startPollLoop(task:()=>Promise<unknown>,intervalMs:number,onError:(error:unknown)=>void) {
 let stopped=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let active:Promise<void>;
 async function tick() {
  try { await task(); } catch(error) { onError(error); }
  finally { if(!stopped)timer=setTimeout(()=>{active=tick();},intervalMs); }
 }
 active=tick();
 return async()=>{stopped=true;if(timer)clearTimeout(timer);await active;};
}
