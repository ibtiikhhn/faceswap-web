/** Tests only local/staging mock data. Never run against a live provider. */
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base = process.env.SMOKE_URL ?? 'http://localhost:3099';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This smoke test is limited to localhost.');
let cookie = '';
async function request(path: string, init: RequestInit = {}, session = cookie) {
 const response = await fetch(`${base}${path}`, { ...init, headers: { Origin: base, ...(session ? { Cookie: session } : {}), ...init.headers }, signal: AbortSignal.timeout(30_000) });
 return response;
}
async function json(path: string, init: RequestInit = {}, session = cookie) {
 const response = await request(path, init, session);
 return { status: response.status, body: await response.json(), response };
}
const guest = await json('/api/guest', { method: 'POST' }, '');
assert.equal(guest.status, 200, JSON.stringify(guest.body));
cookie = guest.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
assert.ok(cookie, 'guest gets an HTTP-only session cookie');
assert.match(guest.response.headers.get('set-cookie') ?? '', /httponly/i);
const bytes = await sharp({create:{width:640,height:480,channels:3,background:'#cadc9c'}}).png().toBuffer();
async function upload(kind: 'source'|'target') {
 const body = new FormData();
 body.append('kind', kind);body.append('file', new Blob([new Uint8Array(bytes)],{type:'image/png'}), `${kind}-fixture.png`);
 const result = await json('/api/uploads', {method:'POST',body});
 assert.ok([200,201].includes(result.status), JSON.stringify(result.body));
 const id = result.body.asset?.id ?? result.body.assetId ?? result.body.id;
 assert.ok(id, 'upload provides asset ID');return id as string;
}
const sourceAssetId=await upload('source');const targetAssetId=await upload('target');
const foreign = await json('/api/guest',{method:'POST'},'');
const foreignCookie=foreign.response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
const access=await request(`/api/assets/${sourceAssetId}/download`,{},foreignCookie);
assert.ok([403,404].includes(access.status),'another guest cannot access uploaded photo');
const body={sourceAssetId,targetAssetId,requestKey:crypto.randomUUID()};
const created=await json('/api/swaps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.ok([200,201,202].includes(created.status),JSON.stringify(created.body));
let job=created.body.job;
assert.ok(job?.id,'job ID returned');
const replay=await json('/api/swaps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal(replay.body.job?.id,job.id,'same request returns original job');
for(let n=0;n<35&&!['succeeded','failed','canceled'].includes(job.status??job.state);n++) {
 await new Promise(resolve=>setTimeout(resolve,1000));
 const result=await json(`/api/swaps/${job.id}`);assert.equal(result.status,200);job=result.body.job;
}
assert.equal(job.status??job.state,'succeeded',JSON.stringify(job));
const resultId=job.resultAssetId??job.result_asset_id;assert.ok(resultId);
const image=await request(`/api/assets/${resultId}/download`);assert.equal(image.status,200);assert.match(image.headers.get('content-type')??'',/image\//);
assert.ok((await image.arrayBuffer()).byteLength>0,'saved output can be downloaded');
const retry=await json('/api/swaps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestKey:crypto.randomUUID()})});
assert.ok([402,403,409].includes(retry.status),'second trial is blocked');
const readForeign=await request(`/api/swaps/${job.id}`,{},foreignCookie);assert.ok([403,404].includes(readForeign.status),'job ownership enforced');
const list=await json('/api/swaps');assert.ok(list.body.jobs.some((item:{id:string})=>item.id===job.id),'job persists in history');
const badForm=new FormData();badForm.append('kind','source');badForm.append('file',new Blob(['not an image'],{type:'image/png'}),'bad.png');
const bad=await json('/api/uploads',{method:'POST',body:badForm},foreignCookie);assert.ok([400,413,415,422].includes(bad.status),'spoofed image rejected');
const cross=await request('/api/guest',{method:'POST',headers:{Origin:'https://unrelated.example'}});assert.equal(cross.status,403,'cross-origin mutation blocked');
console.log('PASS: upload normalization, private access, persisted job, idempotency, worker output, trial limit, history, invalid images, and origin checks.');
