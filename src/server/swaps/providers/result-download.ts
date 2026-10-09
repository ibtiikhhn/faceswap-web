import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request } from 'node:https';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(address,prefix,'ipv4');
// Accept only global-unicast IPv6; exclude mapped, NAT64, local, multicast, and documentation addresses.
const globalV6 = new BlockList(); globalV6.addSubnet('2000::',3,'ipv6');
blocked.addSubnet('2001::',23,'ipv6'); blocked.addSubnet('2001:db8::',32,'ipv6'); blocked.addSubnet('2002::',16,'ipv6');
export function isPublicAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address,'ipv4') : family === 6 && globalV6.check(address,'ipv6') && !blocked.check(address,'ipv6');
}
export function validateResultUrl(raw: string, hosts: string[]) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname.replace(/^\[|\]$/g,'')) || !hosts.includes(url.hostname.toLowerCase())) throw new Error('Result URL is not on an approved HTTPS host.');
  return url;
}
export const MAX_RESULT_BYTES = 20 * 1024 * 1024;

/** Pin the validated DNS address for the actual TLS connection, including every redirect. */
export async function downloadResult(raw: string, hosts: string[], signal = AbortSignal.timeout(30_000), redirects = 0): Promise<Buffer> {
  const url = validateResultUrl(raw,hosts);
  signal.throwIfAborted();
  let abort: (() => void) | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname,{all:true}),
    new Promise<never>((_resolve,reject) => {
      abort=()=>reject(new Error('Result DNS lookup timed out.'));
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted)abort();
    }),
  ]).finally(()=>{if(abort)signal.removeEventListener('abort',abort);});
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new Error('Result host does not resolve to a public address.');
  signal.throwIfAborted();
  const pinned = addresses[0];
  return new Promise((resolve,reject) => {
    const req = request(url,{signal,method:'GET',headers:{Accept:'image/*'},lookup:(_hostname,options,callback) => {
      if (options.all) callback(null,[pinned]); else callback(null,pinned.address,pinned.family);
    }},res => {
      const status = res.statusCode ?? 0;
      if ([301,302,303,307,308].includes(status)) {
        res.destroy();
        if (!res.headers.location || redirects >= 3) { reject(new Error('Result redirect limit exceeded.')); return; }
        try { resolve(downloadResult(new URL(res.headers.location,url).href,hosts,signal,redirects+1)); } catch { reject(new Error('Invalid result redirect.')); }
        return;
      }
      if (status < 200 || status >= 300 || Number(res.headers['content-length'] ?? 0) > MAX_RESULT_BYTES) { res.destroy(); reject(new Error('Result download failed or is too large.')); return; }
      let size=0; const chunks:Buffer[]=[];
      res.on('data',(chunk:Buffer) => { size+=chunk.length; if(size>MAX_RESULT_BYTES){res.destroy(new Error('Result image is too large.'));return;} chunks.push(chunk); });
      res.on('end',() => size ? resolve(Buffer.concat(chunks)) : reject(new Error('Result image is empty.')));
      res.on('error',reject);
      res.on('aborted',() => reject(new Error('Result download interrupted.')));
    });
    req.on('error',reject); req.end();
  });
}
