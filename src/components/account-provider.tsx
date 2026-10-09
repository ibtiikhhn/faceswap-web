'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, errorMessage } from './api-client';
import type { Account } from '@/lib/account-presentation';

type AccountState = { account: Account | null; loading: boolean; error: string; refresh: () => Promise<void>; syncBilling: () => void };
const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<Promise<void> | null>(null);
  const pathname = usePathname();
  const billingDeadline = useRef(0);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    pending.current = api<Account>('/api/account', { cache: 'no-store' })
      .then(data => { setAccount(data); setError(''); })
      .catch(e => { setAccount(null); setError(errorMessage(e)); })
      .finally(() => { setLoading(false); pending.current = null; });
    return pending.current;
  }, []);
  const syncBilling = useCallback(() => {
    billingDeadline.current = Date.now() + 120_000;
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() < billingDeadline.current && document.visibilityState === 'visible') void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return <AccountContext.Provider value={{ account, loading, error, refresh, syncBilling }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const state = useContext(AccountContext);
  if (!state) throw new Error('useAccount requires AccountProvider');
  return state;
}
