import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth/auth';
import { featureState } from '@/server/env';
import { config503, fail } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request){if(!featureState().auth)return config503('Google sign-in');try{return await toNextJsHandler(getAuth()).GET(request);}catch(e){return fail(e);}}
export async function POST(request:Request){if(!featureState().auth)return config503('Google sign-in');try{return await toNextJsHandler(getAuth()).POST(request);}catch(e){return fail(e);}}
