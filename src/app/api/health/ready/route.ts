import { getPool } from '@/server/db';
import { featureState } from '@/server/env';
import { json } from '@/server/http';
export async function GET(){try{if(!featureState().database)return json({ok:false,reason:'database_not_configured'},503);await getPool().query('select id from app.users limit 0');return json({ok:true});}catch{return json({ok:false,reason:'database_unavailable'},503);}}
