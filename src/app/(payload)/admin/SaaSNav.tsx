import Link from 'next/link';
export default function SaaSNav() {
  return (
    <nav className="cms-saas-nav" aria-label="Business operations">
      <span>SWAPTHISFACE</span>
      {[
        ['overview', 'Overview'],
        ['customers', 'Customers'],
        ['generations', 'Generations'],
        ['billing', 'Billing & webhooks'],
        ['audit', 'Owner activity'],
      ].map(([tab, label]) => (
        <Link prefetch={false} key={tab} href={`/admin/saas?tab=${tab}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
