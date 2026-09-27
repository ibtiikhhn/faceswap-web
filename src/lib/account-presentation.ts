export type Account = {
  authenticated?: boolean;
  user?: { id: string; name?: string | null; email?: string | null } | null;
  credits?: number | { available?: number; reserved?: number };
  subscription?: { status?: string; planCode?: string | null; currentPeriodEnd?: string | null } | null;
  trial?: { state?: string | null };
};

export function accountPresentation(account: Account | null, loading: boolean, error: string) {
  const signedIn = Boolean(account?.authenticated || account?.user);
  const credits = typeof account?.credits === 'number' ? account.credits : account?.credits?.available ?? 0;
  if (signedIn) return { signedIn, credits, label: 'Create a swap', href: '/face-swap', note: `${credits} available ${credits === 1 ? 'credit' : 'credits'}. Manage your plan in your account.` };
  if (loading || error) return { signedIn, credits, label: 'Open studio', href: '/face-swap', note: 'Upload two photos to get started.' };
  if (account?.trial?.state === 'consumed') return { signedIn, credits, label: 'Continue creating', href: '/login?next=/pricing', note: 'Your free swap is used. Sign in and choose a plan to continue.' };
  if (account?.trial?.state === 'reserved') return { signedIn, credits, label: 'Open studio', href: '/face-swap', note: 'Your free swap is already in progress.' };
  return { signedIn, credits, label: 'Try for free', href: '/face-swap', note: 'One free swap. No account needed.' };
}
