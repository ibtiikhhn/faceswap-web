import type { Metadata } from 'next';
import { publicIndexingEnabled, siteOrigin } from '@/lib/seo';
import { Header, Footer } from '@/components/site-shell';
import './globals.css';
import { AccountProvider } from '@/components/account-provider';

export const metadata: Metadata = {
 metadataBase: new URL(siteOrigin()),
 icons: {
  icon: [{url:'/favicon-96.png',sizes:'96x96',type:'image/png'}],
  apple: [{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}],
 },
 title: { default: 'AI Face Swap Online – Put Your Face in Any Photo', template: '%s | SwapThisFace' },
 description: 'Recreate photos with your face using AI. Try a travel shot, a new portrait or a different look. Your first photo face swap is free, with no signup needed.',
 robots: publicIndexingEnabled() ? { index: true, follow: true } : { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><AccountProvider><Header /><main id="main">{process.env.SWAPS_ENABLED === 'false' && <div className="wrap"><p className="inline-notice" role="status">Coming soon: photo processing and paid plans are not available yet. Explore SwapThisFace.com while we prepare for launch.</p></div>}{children}</main><Footer /></AccountProvider></body></html>;
}
