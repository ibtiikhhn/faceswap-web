'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Aperture, ArrowUpRight, Menu, X } from './icons';
import { useAccount } from './account-provider';
import { accountPresentation } from '@/lib/account-presentation';

export function Brand() {
  return <Link href="/" className="brand" aria-label="SwapThisFace.com home"><span className="brand-symbol"><Aperture size={23} strokeWidth={2.3} /></span><span>SwapThisFace<span className="brand-domain">.com</span></span></Link>;
}

export function Header() {
  const pathname = usePathname();
  const state = useAccount();
  const view = accountPresentation(state.account, state.loading, state.error);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  const links = [{ href: '/face-swap', label: 'Face swap' }, { href: '/pricing', label: 'Pricing' }, { href: '/blog', label: 'Journal' }];
  return <header className="site-header" ref={header}><div className="header-inner"><Brand />
    <nav id="main-navigation" aria-label="Main navigation" className={open ? 'main-nav is-open' : 'main-nav'} onClick={() => setOpen(false)}>
      {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}>{link.label}</Link>)}
      <div className="mobile-account-links">
        {view.signedIn ? <><Link href="/dashboard">My account <span>{view.credits} credits</span></Link><Link href="/dashboard/history">My creations</Link><Link href="/dashboard/billing">Plan & credits</Link><Link href="/dashboard/settings">Settings & sign out</Link></> : <Link href="/login">Sign in with Google</Link>}
        <Link href={view.href} className="button button-dark">{view.label}<ArrowUpRight size={16}/></Link>
      </div>
    </nav>
    <div className="header-actions"><Link href={view.signedIn ? '/dashboard' : '/login'} className="sign-in-link">{view.signedIn ? 'My account' : 'Sign in'}</Link><Link href={view.href} className="button button-dark button-small header-cta">{view.label}<ArrowUpRight size={15}/></Link><button ref={toggle} className="mobile-menu icon-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="main-navigation">{open ? <X size={22}/> : <Menu size={22}/>}</button></div>
  </div></header>;
}

export function StudioInvitation() {
  const state = useAccount();
  const view = accountPresentation(state.account, state.loading, state.error);
  return <div className="hero-actions"><Link href={view.href === '/face-swap' ? '#studio' : view.href} className="button button-dark">{view.label}<ArrowUpRight size={18}/></Link><span className="subtle-note">{view.note}</span></div>;
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-top"><div><Brand/><p>A new perspective, one photo at a time.</p></div><div className="footer-links"><Link href="/face-swap">Create a swap</Link><Link href="/pricing">Pricing</Link><Link href="/blog">Journal</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms & conditions</Link><Link href="/refunds">Refund policy</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Codeflow Solutions · SwapThisFace.com</span><a href="mailto:jasperburges0@gmail.com">Contact support <ArrowUpRight size={13}/></a></div></footer>;
}
