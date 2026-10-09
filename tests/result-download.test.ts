import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn()}));
vi.mock('node:dns/promises',()=>({lookup:mocked.lookup}));
vi.mock('node:https',()=>({request:mocked.request}));
import { downloadResult, MAX_RESULT_BYTES } from '../src/server/swaps/providers/result-download';
function respond(status:number,headers:Record<string,string>={},body=Buffer.from('image bytes')){
 mocked.request.mockImplementationOnce((_url,options,callback)=>{
  const req=new EventEmitter() as EventEmitter & {end:()=>void};
  req.end=()=>{const res=Object.assign(new PassThrough(),{statusCode:status,headers});callback(res);queueMicrotask(()=>res.end(body));};
  return req;
 });
}
beforeEach(()=>{vi.resetAllMocks();mocked.lookup.mockResolvedValue([{address:'8.8.8.8',family:4}]);});
describe('secure result transport',()=>{
 it('pins the DNS answer rather than resolving again during connection',async()=>{
  respond(200);expect((await downloadResult('https://images.example.com/photo',['images.example.com'])).toString()).toBe('image bytes');
  const options=mocked.request.mock.calls[0][1];const callback=vi.fn();options.lookup('images.example.com',{all:false},callback);expect(callback).toHaveBeenCalledWith(null,'8.8.8.8',4);
  options.lookup('images.example.com',{all:true},callback);expect(callback).toHaveBeenLastCalledWith(null,[{address:'8.8.8.8',family:4}]);
  expect(options.rejectUnauthorized).not.toBe(false);
 });
 it('rejects mixed public/private DNS answers before connecting',async()=>{
  mocked.lookup.mockResolvedValue([{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]);
  await expect(downloadResult('https://images.example.com/photo',['images.example.com'])).rejects.toThrow(/public/);expect(mocked.request).not.toHaveBeenCalled();
 });
 it('does not follow a redirect to an unapproved host',async()=>{
  respond(302,{location:'https://internal.example.com/secret'});
  await expect(downloadResult('https://images.example.com/photo',['images.example.com'])).rejects.toThrow(/approved/);expect(mocked.request).toHaveBeenCalledTimes(1);
 });
 it('checks DNS again for each approved redirect',async()=>{
  respond(302,{location:'https://cdn.example.com/photo'});respond(200);
  await downloadResult('https://images.example.com/photo',['images.example.com','cdn.example.com']);expect(mocked.lookup).toHaveBeenCalledTimes(2);
 });
 it('bounds redirects',async()=>{
  for(let i=0;i<4;i++)respond(302,{location:'/again'});
  await expect(downloadResult('https://images.example.com/photo',['images.example.com'])).rejects.toThrow(/limit/);expect(mocked.request).toHaveBeenCalledTimes(4);
 });
 it('rejects oversized chunked output without trusting content-length',async()=>{
  respond(200,{},Buffer.alloc(MAX_RESULT_BYTES+1));
  await expect(downloadResult('https://images.example.com/photo',['images.example.com'])).rejects.toThrow(/large/);
 });
});
