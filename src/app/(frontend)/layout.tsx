import type { Metadata } from 'next';
import { Header, Footer } from '@/components/site-shell';
import './globals.css';

export const metadata: Metadata = {
 title: { default: 'Facecraft — A new look starts with you', template: '%s · Facecraft' },
 description: 'Your face, a fresh perspective. Create photo face swaps in a simple, private creative studio.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /></body></html>;
}
