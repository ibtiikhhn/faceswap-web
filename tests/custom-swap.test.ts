import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { customSwap, type CustomDependencies } from '../src/server/swaps/providers/custom';
import { isPublicAddress, validateResultUrl } from '../src/server/swaps/providers/result-download';

let source:Buffer; let target:Buffer;
beforeAll(async()=>{
  source=await sharp({create:{width:80,height:60,channels:3,background:'#ff0000'}}).png().toBuffer();
  target=await sharp({create:{width:100,height:80,channels:3,background:'#0000ff'}}).webp().toBuffer();
});
const success=()=>Response.json({external_api_response:{output:['https://images.example.com/result.jpg?secret=temporary']}});
function setup(responses:Response[]=[success()]) {
  const fetcher=vi.fn<typeof fetch>(); responses.forEach(response=>fetcher.mockResolvedValueOnce(response));
  const download=vi.fn().mockResolvedValue(target); const pause=vi.fn().mockResolvedValue(undefined);
  return {deps:{fetch:fetcher,download,pause} as CustomDependencies,fetcher,download,pause};
}
function input(){return {source,target,endpoint:'https://faceswap-django.onrender.com/faceswap_file/',resultHosts:['images.example.com']};}

describe('Custom Swap contract',()=>{
 it('sends exact JPEG fields with distinct source/target and stores decoded WebP bytes',async()=>{
  const {deps,fetcher,download}=setup(); const result=await customSwap(input(),deps);
  const [url,options]=fetcher.mock.calls[0];
  expect(String(url)).toBe(input().endpoint); expect(options?.method).toBe('POST'); expect(options?.headers).toBeUndefined(); expect(options?.redirect).toBe('error');
  const form=options?.body as FormData; expect([...form.keys()]).toEqual(['source_image','target_image']);
  for(const [name,width] of [['source_image',80],['target_image',100]] as const){
   const file=form.get(name) as File; expect(file.type).toBe('image/jpeg');
   const meta=await sharp(Buffer.from(await file.arrayBuffer())).metadata(); expect(meta.format).toBe('jpeg');expect(meta.width).toBe(width);
  }
  expect(download).toHaveBeenCalledTimes(1); expect((await sharp(result).metadata()).format).toBe('webp');
 });
 it('retries busy responses with backoff, then succeeds',async()=>{
  const {deps,fetcher,pause}=setup([new Response('',{status:429}),new Response('',{status:503}),success()]);
  await customSwap(input(),deps);expect(fetcher).toHaveBeenCalledTimes(3);expect(pause).toHaveBeenCalledTimes(2);
  expect(pause.mock.calls[0][0]).toBeGreaterThanOrEqual(1000);expect(pause.mock.calls[1][0]).toBeGreaterThanOrEqual(2000);
 });
 it('bounds network retries and returns a safe error',async()=>{
  const {deps,fetcher}=setup([]); fetcher.mockRejectedValue(new Error('secret provider URL'));
  await expect(customSwap(input(),deps)).rejects.toMatchObject({code:'provider_network_error'});expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it('does not retry an invalid-image 400 or expose upstream error text',async()=>{
  const {deps,fetcher}=setup([Response.json({error:'secret upstream diagnostic'},{status:400})]);
  await expect(customSwap(input(),deps)).rejects.toMatchObject({code:'provider_rejected',message:expect.not.stringContaining('secret')});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it.each([{}, {external_api_response:{output:[]}}, {external_api_response:{output:[12]}}, {external_api_response:{output:'not-array'}}])('rejects malformed output %j',async body=>{
  const {deps,download}=setup([Response.json(body)]);await expect(customSwap(input(),deps)).rejects.toMatchObject({code:'provider_invalid_response'});expect(download).not.toHaveBeenCalled();
 });
 it('rejects invalid JSON and oversized response bodies',async()=>{
  for(const body of ['not json','x'.repeat(65537)]){const {deps}=setup([new Response(body)]);await expect(customSwap(input(),deps)).rejects.toMatchObject({code:'provider_invalid_response'});}
 });
 it('retries result download without submitting another swap',async()=>{
  const {deps,fetcher,download}=setup();download.mockReset().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue(target);
  await customSwap(input(),deps);expect(fetcher).toHaveBeenCalledTimes(1);expect(download).toHaveBeenCalledTimes(2);
 });
 it('fails unreadable image output instead of saving arbitrary bytes',async()=>{
  const {deps,download}=setup();download.mockResolvedValue(Buffer.from('<html>not an image</html>'));
  await expect(customSwap(input(),deps)).rejects.toMatchObject({code:'provider_invalid_image'});
 });
 it('fails before transmitting when the result allowlist is missing',async()=>{
  const {deps,fetcher}=setup();await expect(customSwap({...input(),resultHosts:[]},deps)).rejects.toMatchObject({code:'provider_not_configured'});expect(fetcher).not.toHaveBeenCalled();
 });
 it('rotates EXIF orientation and limits dimensions without upscaling small photos',async()=>{
  const portrait=await sharp({create:{width:2500,height:1000,channels:3,background:'#abc'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const {deps,fetcher}=setup();await customSwap({...input(),source:portrait},deps);
  const file=(fetcher.mock.calls[0][1]?.body as FormData).get('source_image') as File;
  const meta=await sharp(Buffer.from(await file.arrayBuffer())).metadata();expect(meta.height).toBe(2048);expect(meta.width).toBeLessThan(2048);expect(meta.orientation).toBeUndefined();
 });
});
describe('result download boundaries',()=>{
 it.each(['http://images.example.com/a','https://images.example.com.evil.test/a','https://user:password@images.example.com/a','https://images.example.com:444/a','https://127.0.0.1/a','file:///tmp/a'])('rejects %s',url=>{expect(()=>validateResultUrl(url,['images.example.com','127.0.0.1'])).toThrow();});
 it('allows only the exact approved HTTPS hostname',()=>{expect(validateResultUrl('https://images.example.com/a?token=abc',['images.example.com']).hostname).toBe('images.example.com');});
 it.each(['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.2.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','64:ff9b::7f00:1'])('blocks non-public address %s',ip=>expect(isPublicAddress(ip)).toBe(false));
 it('accepts global addresses',()=>{expect(isPublicAddress('8.8.8.8')).toBe(true);expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);});
});
