import { Environment, LogLevel, Paddle } from '@paddle/paddle-node-sdk';
import { env } from '@/server/env';
import { HttpError } from '@/server/http';
import { paddleReady } from './catalog';

export function requirePaddle() {
  if (!paddleReady()) throw new HttpError(503, 'Purchases are not available yet.', 'billing_unavailable');
  const settings = env();
  if (settings.PADDLE_ENVIRONMENT === 'production' && settings.APP_ENV !== 'production') throw new HttpError(503, 'Live billing is not enabled in this environment.', 'billing_unavailable');
  if (!(settings.PADDLE_CLIENT_TOKEN ?? '').startsWith(settings.PADDLE_ENVIRONMENT === 'sandbox' ? 'test_' : 'live_')) throw new HttpError(503, 'Payment environment configuration is incomplete.', 'billing_unavailable');
  return settings;
}
export function getPaddle() {
  const settings = env();
  if (!settings.PADDLE_API_KEY) throw new HttpError(503, 'Payments are not configured.', 'billing_unavailable');
  const sandbox = settings.PADDLE_ENVIRONMENT === 'sandbox';
  if (!sandbox && settings.APP_ENV !== 'production') throw new HttpError(503, 'Live billing requires the production app environment.', 'billing_unavailable');
  if (sandbox !== settings.PADDLE_API_KEY.startsWith('pdl_sdbx_')) throw new HttpError(503, 'Payment environment configuration is incomplete.', 'billing_unavailable');
  return new Paddle(settings.PADDLE_API_KEY, { environment: sandbox ? Environment.sandbox : Environment.production, logLevel: LogLevel.none });
}

export function paddleEnvironment() { return env().PADDLE_ENVIRONMENT; }
export function paddleCustomerColumn() { return paddleEnvironment()==='sandbox'?'paddle_sandbox_customer_id':'paddle_customer_id'; }
