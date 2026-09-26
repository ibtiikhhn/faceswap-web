'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Aperture, ArrowUpRight, Menu, X } from './icons';

export function Brand() {
  return <Link href="/" className="brand" aria-label="Facecraft home"><span className="brand-symbol"><Aperture size={23} strokeWidth={2.3} /></span>facecraft<span className="brand-dot">.</span></Link>;
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return <header className="site-header"><div className="header-inner"><Brand /><nav aria-label="Main navigation" className={open ? 'main-nav is-open' : 'main-nav'}>
    <Link className={pathname === '/face-swap' ? 'active' : ''} href="/face-swap">Face swap</Link>
    <Link className={pathname === '/pricing' ? 'active' : ''} href="/pricing">Pricing</Link>
    <Link className={pathname.startsWith('/blog') ? 'active' : ''} href="/blog">The journal</Link>
  </nav><div className="header-actions"><Link href="/dashboard" className="sign-in-link">My studio</Link><Link href="/face-swap" className="button button-dark button-small">Try for free <ArrowUpRight size={15} /></Link><button className="mobile-menu icon-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X size={22} /> : <Menu size={22} />}</button></div></div></header>;
}

export function Footer() {
 return <footer className="site-footer"><div className="footer-top"><div><Brand /><p>A little curiosity. A whole new you.</p></div><div className="footer-links"><Link href="/face-swap">Create a swap</Link><Link href="/pricing">Pricing</Link><Link href="/blog">Journal</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Facecraft</span><span>Made for your imagination <span className="tiny-spark">✳</span></span></div></footer>;
}
