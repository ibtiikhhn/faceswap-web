import { describe, expect, it } from 'vitest';
import { accountPresentation } from '../src/lib/account-presentation';

describe('account-aware calls to action', () => {
  it('does not advertise a free trial while identity is unknown or unavailable', () => {
    expect(accountPresentation(null, true, '').label).toBe('Open studio');
    expect(accountPresentation(null, false, 'offline').label).toBe('Open studio');
  });
  it('shows the trial only for an eligible guest', () => {
    expect(accountPresentation({ authenticated: false, trial: { state: 'available' } }, false, '').label).toBe('Try for free');
    expect(accountPresentation({ authenticated: false, trial: { state: 'consumed' } }, false, '').href).toBe('/login?next=/pricing');
    expect(accountPresentation({ authenticated: false, trial: { state: 'reserved' } }, false, '').label).toBe('Open studio');
  });
  it('always prioritizes the signed-in account over a guest trial, including zero credits', () => {
    const result = accountPresentation({ authenticated: true, trial: { state: 'available' }, credits: { available: 0, reserved: 1 } }, false, '');
    expect(result.label).toBe('Create a swap');
    expect(result.note).toContain('0 available credits');
    expect(result.signedIn).toBe(true);
  });
  it('uses the available balance, not reserved credits', () => {
    expect(accountPresentation({ authenticated: true, credits: { available: 1, reserved: 4 } }, false, '').note).toContain('1 available credit.');
  });
});
