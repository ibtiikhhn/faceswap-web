import { pageMetadata } from '@/lib/seo';
import { ContactEmail, LegalLayout } from '@/components/legal-layout';

export const metadata = pageMetadata('Refund policy', 'Payment availability, refund questions, and support for SwapThisFace.com, operated by Codeflow Solutions in Pakistan.', '/refunds');
const sections = [['availability', 'Payment availability'], ['support', 'Payment questions'], ['future', 'Future paid plans']] as const;

export default function Refunds() {
  return <LegalLayout title="Refund policy" description="SwapThisFace.com is operated by Codeflow Solutions in Pakistan. This page explains the current payment status and how to contact us about payment questions." sections={sections}>
    <section id="availability"><h2>1. Payments are not available yet</h2><p>We are not currently accepting subscription or credit-pack purchases. Our free guest trial does not charge a payment method or automatically start a paid subscription. No refund is needed for an unused free trial.</p></section>
    <section id="support"><h2>2. Questions about a charge</h2><p>If you believe you have been charged in connection with SwapThisFace.com, contact <ContactEmail/> with the date, amount, account email, and transaction reference so we can investigate. Do not send full payment card details, passwords, or banking credentials.</p></section>
    <section id="future"><h2>3. Future paid plans</h2><p>We plan to introduce subscriptions and credit purchases through Paddle. Before purchases open, we will publish the applicable refund eligibility, request process, cancellation rules, and any statutory withdrawal information here and at checkout. Paddle integration is not currently active.</p><p>This page does not establish a blanket no-refund policy or limit mandatory consumer rights. Paid plans will remain unavailable until their prices and payment terms are published.</p></section>
  </LegalLayout>;
}
