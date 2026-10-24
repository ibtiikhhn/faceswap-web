/** Destructive only to two in-memory SQLite databases; never reads .env.local. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DatabaseSync,type SQLInputValue } from 'node:sqlite';
const app=new DatabaseSync(':memory:'),cms=new DatabaseSync(':memory:');
for(const db of [app,cms])db.exec('PRAGMA foreign_keys=ON');
const server=createServer(async(request,response)=>{
 try {
  const parts:Buffer[]=[];for await(const chunk of request)parts.push(Buffer.from(chunk));
  const {statements}=JSON.parse(Buffer.concat(parts).toString()) as {statements:{sql:string;params:SQLInputValue[];raw?:boolean}[]};
  const db=request.url==='/app'?app:cms;
  db.exec('BEGIN');
  try{
   const result=statements.map(s=>{
    const q=db.prepare(s.sql);
    if(s.raw){q.setReturnArrays(true);return {raw:q.all(...s.params),results:[],success:true,meta:{changes:0}};}
    const results=q.all(...s.params);return {results,success:true,meta:{changes:db.prepare('SELECT changes() AS n').get()!.n,last_row_id:db.prepare('SELECT last_insert_rowid() AS n').get()!.n}};
   });
   db.exec('COMMIT');response.setHeader('Content-Type','application/json');response.end(JSON.stringify({result}));
  }catch(error){db.exec('ROLLBACK');throw error;}
 }catch(error){console.error(error);response.statusCode=500;response.end(JSON.stringify({error:'D1_QUERY_FAILED'}));}
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();if(!address||typeof address==='string')throw new Error('No local address');
Object.assign(process.env,{DATABASE_DRIVER:'d1',D1_GATEWAY_URL:`http://127.0.0.1:${address.port}`,D1_GATEWAY_SECRET:'test-only',APP_ENV:'test',SWAP_PROVIDER:'mock',SWAPS_ENABLED:'true',PAYLOAD_SECRET:'test-local-payload-secret-32-characters',BETTER_AUTH_SECRET:'test-local-better-auth-secret-32-characters',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',APP_URL:'http://localhost:3000',BILLING_PROVIDER:'whop',PAYLOAD_MIGRATING:'true'});
try {
 const {migrateD1}=await import('../src/server/db/d1/migrate');await migrateD1();await migrateD1();
 const {createAuth}=await import('../src/server/auth/auth');
 const auth=createAuth();const context=await auth.$context;
 const user=await context.internalAdapter.createUser({email:'d1-auth@test.invalid',name:'D1 Test',emailVerified:true},{method:'oauth',oauth:{providerId:'google'}});
 assert.match(user.id,/^[0-9a-f-]{36}$/);
 await context.internalAdapter.linkAccount({userId:user.id,providerId:'google',accountId:'test-google'});
 const session=await context.internalAdapter.createSession(user.id);
 assert.ok(session.expiresAt instanceof Date);
 // Signed cookie HTTP authentication is tested manually; database lookup is verified here.
 const stored=await context.internalAdapter.findSession(session.token);assert.equal(stored?.user.id,user.id);
 await context.internalAdapter.deleteSession(session.token);
 assert.equal(await context.internalAdapter.findSession(session.token),null);
 console.log('D1 Google account/session storage: passed');
 const {getPayload}=await import('payload');const {default:config}=await import('../payload.config');
 const payload=await getPayload({config});await payload.db.migrate();
 const owner=await payload.create({collection:'owners',data:{email:'d1-owner@test.invalid',password:'test-only-local-password',name:'Test',role:'owner'}});
 const login=await payload.login({collection:'owners',data:{email:owner.email,password:'test-only-local-password'}});assert.ok(login.token);
 const post=await payload.create({collection:'posts',draft:true,data:{title:'D1 draft',slug:'d1-draft',summary:'Local migration verification',author:owner.id,content:{root:{type:'root',version:1,children:[{type:'paragraph',version:1,children:[{type:'text',version:1,text:'Local test content',detail:0,format:0,mode:'normal',style:''}],direction:null,format:'',indent:0}],direction:null,format:'',indent:0}}}});
 await payload.update({collection:'posts',id:post.id,data:{_status:'published',publishedAt:new Date().toISOString()}});
 const publicPost=await payload.find({collection:'posts',overrideAccess:false,where:{slug:{equals:'d1-draft'}}});assert.equal(publicPost.docs.length,1);
 await payload.delete({collection:'posts',id:post.id});
 console.log('D1 CMS migrations, owner login, draft/publish/read/delete: passed');
 await payload.destroy();
} finally {
 server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));app.close();cms.close();
}
