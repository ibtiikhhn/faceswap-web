import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { assertOrigin } from '@/server/http';
import { billingErrorResponse,json } from '@/server/billing/http';
import { managePaddleSubscription } from '@/server/billing/paddle/subscription';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{assertOrigin(request);const userId=await requireUser(request);return json(await managePaddleSubscription(userId,await request.json()));}
 catch(error){return billingErrorResponse(error);}
}
