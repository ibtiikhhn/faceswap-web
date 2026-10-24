// Private SQL gateway. Only Railway server processes hold the bearer secret.
// Native D1 batch() is the transaction boundary; never expose this URL/secret to browsers.
export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || !env.D1_GATEWAY_SECRET) return new Response('Not found', {status:404});
    const provided = request.headers.get('Authorization') ?? '';
    const expected = `Bearer ${env.D1_GATEWAY_SECRET}`;
    const encoder = new TextEncoder();
    const hash = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
    const [a,b] = await Promise.all([hash(provided),hash(expected)]);
    if (!crypto.subtle.timingSafeEqual(a,b)) return new Response('Unauthorized',{status:401});
    const name = new URL(request.url).pathname;
    const db = name === '/app' ? env.APP_DB : name === '/cms' ? env.CMS_DB : null;
    if (!db) return new Response('Not found',{status:404});
    try {
      const {statements} = await request.json();
      if (!Array.isArray(statements) || !statements.length || statements.length > 500 || statements.some(s => typeof s.sql !== 'string' || !Array.isArray(s.params))) return new Response('Invalid batch',{status:400});
      if(statements.length===1 && statements[0].raw) {
        const s=statements[0];
        const raw=await db.prepare(s.sql).bind(...s.params).raw();
        return Response.json({result:[{results:[],success:true,meta:{changes:0},raw}]});
      }
      const result = await db.batch(statements.map(s => db.prepare(s.sql).bind(...s.params)));
      return Response.json({result});
    } catch (error) {
      // No query text, parameter values, or raw errors cross the boundary.
      const conflict = String(error).includes('app_d1_guard');
      console.error(conflict ? 'D1 revision conflict' : 'D1 batch failed');
      return Response.json({error: conflict ? 'D1_WRITE_CONFLICT' : 'D1_QUERY_FAILED'},{status:conflict ? 409 : 500});
    }
  }
};
