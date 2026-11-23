import {describe,it,expect,vi} from 'vitest';
import {ownerAssetResponse} from '@/cms/owner-media';
const id='11111111-1111-4111-8111-111111111111';
const owner={collection:'owners',role:'owner'};
describe('private owner image access',()=>{
 it('rejects anonymous and customer identities before reading any images',async()=>{
  const query=vi.fn();const read=vi.fn();
  for(const user of [null,{collection:'users',role:'owner'},{collection:'owners',role:'customer'}])
   await expect(ownerAssetResponse(user,id,{query} as any,read)).rejects.toThrow('Owner access required');
  expect(query).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();
 });
 it('does not serve unavailable photos or invalid IDs',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[]});const read=vi.fn();
  await expect(ownerAssetResponse(owner,'../../secret',{query} as any,read)).rejects.toThrow('Invalid asset');
  await expect(ownerAssetResponse(owner,id,{query} as any,read)).rejects.toThrow('unavailable');
  expect(read).not.toHaveBeenCalled();
 });
 it('streams only an allowed image type and prevents caching',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[{object_key:'private/source.webp',content_type:'image/webp'}]});
  const read=vi.fn().mockResolvedValue(Buffer.from('test-image'));
  const response=await ownerAssetResponse(owner,id,{query} as any,read);
  expect(response.headers.get('Cache-Control')).toContain('no-store');expect(response.headers.get('Content-Type')).toBe('image/webp');
  expect(await response.text()).toBe('test-image');
  query.mockResolvedValue({rows:[{object_key:'bad',content_type:'text/html'}]});
  await expect(ownerAssetResponse(owner,id,{query} as any,read)).rejects.toThrow('Unsupported image');
  expect(read).toHaveBeenCalledTimes(1);
 });
});
