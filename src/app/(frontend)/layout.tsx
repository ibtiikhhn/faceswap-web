import type { Metadata } from 'next';
import { publicIndexingEnabled, siteOrigin } from '@/lib/seo';
import { Header, Footer } from '@/components/site-shell';
import './globals.css';
import { AccountProvider } from '@/components/account-provider';

export const metadata: Metadata = {
 metadataBase: new URL(siteOrigin()),
 title: { default: 'Photo Face Swap Online · SwapThisFace.com', template: '%s · SwapThisFace.com' },
 description: 'Upload a face photo and a target image in the SwapThisFace.com photo face swap studio. Manage your creations, downloads, and account in one place.',
 robots: publicIndexingEnabled() ? { index: true, follow: true } : { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><AccountProvider><Header /><main id="main">{children}</main><Footer /></AccountProvider></body></html>;
}
