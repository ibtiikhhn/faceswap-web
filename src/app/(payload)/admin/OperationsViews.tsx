import Link from 'next/link';
import AdminDate from './AdminDate';
import type { ownerBilling, ownerInsights } from '@/cms/owner-insights';
const fmt = (n: number | string) => Number(n).toLocaleString('en');
const date = (s: string) => <AdminDate value={s} />;
const customerLink = (id: string) =>
  `/admin/saas?customer=${encodeURIComponent(id)}`;

export function OperationsView({
  data,
}: {
  data: Awaited<ReturnType<typeof ownerInsights>>;
}) {
  const total = data.daily.reduce((s, d) => s + d.total, 0);
  const succeeded = data.daily.reduce((s, d) => s + d.succeeded, 0);
  const failed = data.daily.reduce((s, d) => s + d.failed, 0);
  const peak = Math.max(1, ...data.daily.map((d) => d.total));
  const storageMB = Number(data.storage.bytes) / 1024 / 1024;
  return (
    <>
      <section className="cms-saas__pulse">
        <div>
          <span className="cms-saas__eyebrow">OPERATIONS SNAPSHOT</span>
          <h2>Know what needs your attention.</h2>
          <p>Database snapshot at page load. Refresh to see new activity.</p>
        </div>
        <Link prefetch={false} href="/admin/saas?tab=generations&state=failed">
          Inspect failed generations →
        </Link>
      </section>
      <div className="cms-saas__insight-grid">
        <section className="cms-saas__panel">
          <div className="cms-saas__panel-head">
            <div>
              <h2>Generation activity</h2>
              <p>
                UTC calendar days · {fmt(total)} jobs ·{' '}
                {succeeded + failed
                  ? `${((100 * succeeded) / (succeeded + failed)).toFixed(1)}% success among succeeded/failed jobs`
                  : 'No completed jobs in this period'}
              </p>
            </div>
            <nav className="cms-saas__range" aria-label="Activity period">
              {[7, 30].map((days) => (
                <Link
                  prefetch={false}
                  key={days}
                  aria-current={data.range === days ? 'page' : undefined}
                  href={`/admin/saas?tab=overview&days=${days}`}
                >
                  {days} days
                </Link>
              ))}
            </nav>
          </div>
          <div
            className="cms-saas__chart"
            role="img"
            aria-label={`${total} generations over ${data.range} days, ${succeeded} succeeded and ${failed} failed`}
          >
            {data.daily.map((d) => (
              <div
                className="cms-saas__chart-column"
                key={d.day}
                title={`${d.day}: ${d.total} jobs, ${d.succeeded} succeeded, ${d.failed} failed`}
              >
                <div
                  style={{
                    height: `${Math.max(d.total ? 3 : 0, (100 * d.total) / peak)}%`,
                  }}
                />
                <span>{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
          <details className="cms-saas__chart-data">
            <summary>View daily counts</summary>
            <div className="cms-saas__table-wrap">
              <table className="cms-saas__table">
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Jobs</th>
                    <th>Successful</th>
                    <th>Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td>{d.total}</td>
                      <td>{d.succeeded}</td>
                      <td>{d.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="cms-saas__panel">
          <div className="cms-saas__panel-head">
            <div>
              <h2>Queue & storage</h2>
              <p>Current all-time database counts</p>
            </div>
          </div>
          <dl className="cms-saas__health">
            <div>
              <dt>Jobs in progress</dt>
              <dd>{fmt(data.jobs.active)}</dd>
            </div>
            <div>
              <dt>
                No job update for 15+ minutes{' '}
                <small>Inspect before deciding a job is stuck.</small>
              </dt>
              <dd
                className={Number(data.jobs.stale) ? 'cms-saas__warning' : ''}
              >
                <Link
                  prefetch={false}
                  href="/admin/saas?tab=generations&stale=1"
                >
                  {fmt(data.jobs.stale)} →
                </Link>
              </dd>
            </div>
            <div>
              <dt>Active photos</dt>
              <dd>{fmt(data.storage.files)}</dd>
            </div>
            <div>
              <dt>
                Recorded photo storage{' '}
                <small>File sizes in the database, not an R2 inventory.</small>
              </dt>
              <dd>
                {storageMB >= 1024
                  ? `${(storageMB / 1024).toFixed(2)} GB`
                  : `${storageMB.toFixed(1)} MB`}
              </dd>
            </div>
            <div>
              <dt>Explicit deletions awaiting cleanup</dt>
              <dd>{fmt(data.storage.pending_delete)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="cms-saas__panel">
        <div className="cms-saas__panel-head">
          <div>
            <h2>Top failure reasons</h2>
            <p>Last {data.range} UTC calendar days</p>
          </div>
        </div>
        {data.errors.length ? (
          <ul className="cms-saas__error-list">
            {data.errors.map((e) => (
              <li key={e.error_code}>
                <code>{e.error_code}</code>
                <strong>{fmt(e.count)} jobs</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cms-saas__empty">
            No failed generations in this period.
          </p>
        )}
      </section>
    </>
  );
}

export function BillingView({
  data,
  customer,
  search = '',
  attention = false,
}: {
  data: Awaited<ReturnType<typeof ownerBilling>>;
  customer?: string;
  search?: string;
  attention?: boolean;
}) {
  const query = (page = 1) =>
    new URLSearchParams({
      ...(customer ? { customer } : { tab: 'billing' }),
      environment: data.environment,
      billingPage: String(page),
      billingSearch: search,
      ...(attention ? { attention: '1' } : {}),
    }).toString();
  return (
    <section className="cms-saas__billing">
      <div className="cms-saas__panel-head cms-saas__standalone">
        <div>
          <p className="cms-saas__eyebrow">
            WHOP / {data.environment.toUpperCase()}
          </p>
          <h2>Payments & credit delivery</h2>
          <p>
            Recorded payment and credit activity. Monetary totals and refunds
            are managed in Whop.
          </p>
        </div>
        <a href="https://whop.com/dashboard/" target="_blank" rel="noreferrer">
          Open Whop dashboard ↗
        </a>
      </div>
      {!customer && (
        <div className="cms-saas__metrics">
          {[
            ['Active / trial memberships', data.stats.memberships],
            ['Disputed payments', data.stats.disputes],
            ['Unfinished webhook events', data.stats.webhooks],
            ['Webhook retries exhausted', data.stats.exhausted],
          ].map(([label, count]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{fmt(count)}</strong>
            </div>
          ))}
        </div>
      )}
      <section className="cms-saas__panel">
        <div className="cms-saas__panel-head">
          <form action="/admin/saas" className="cms-saas__search">
            <input
              type="hidden"
              name={customer ? 'customer' : 'tab'}
              value={customer || 'billing'}
            />
            <label>
              Environment
              <select name="environment" defaultValue={data.environment}>
                <option value="production">Production</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </label>
            <label>
              Search payments
              <input
                name="billingSearch"
                defaultValue={search}
                placeholder="Customer email or payment ID"
              />
            </label>
            <label>
              View
              <select name="attention" defaultValue={attention ? '1' : ''}>
                <option value="">All recorded payments</option>
                <option value="1">Disputed / credits revoked</option>
              </select>
            </label>
            <button>Apply filters</button>
          </form>
        </div>
        <div className="cms-saas__table-wrap">
          <table className="cms-saas__table">
            <thead>
              <tr>
                <th>Customer / payment</th>
                <th>Offer</th>
                <th>Credits granted</th>
                <th>Credits revoked</th>
                <th>Dispute</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link prefetch={false} href={customerLink(p.user_id)}>
                      {p.email}
                    </Link>
                    <small>
                      <code>{p.id}</code>
                    </small>
                  </td>
                  <td>
                    {p.code || 'Unknown offer'}
                    <small>
                      {p.membership_id
                        ? 'Subscription payment'
                        : 'Credit pack / one-time'}
                    </small>
                  </td>
                  <td>
                    {p.granted == null ? 'No grant linked' : fmt(p.granted)}
                  </td>
                  <td>{fmt(p.revoked_credits)}</td>
                  <td>
                    {p.disputed ? (
                      <strong className="cms-saas__warning">Disputed</strong>
                    ) : (
                      'None recorded'
                    )}
                  </td>
                  <td>{date(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.payments.length && (
          <p className="cms-saas__empty">No payments match these filters.</p>
        )}
        <nav className="cms-saas__pager" aria-label="Payment pagination">
          <span>
            {fmt(data.total)} records · Page {data.page}
          </span>
          <div>
            {data.page > 1 && (
              <Link
                prefetch={false}
                href={`/admin/saas?${query(data.page - 1)}`}
              >
                ← Previous
              </Link>
            )}
            {data.page * 25 < data.total && (
              <Link
                prefetch={false}
                href={`/admin/saas?${query(data.page + 1)}`}
              >
                Next →
              </Link>
            )}
          </div>
        </nav>
      </section>
      <section className="cms-saas__panel">
        <div className="cms-saas__panel-head">
          <div>
            <h2>Subscriptions</h2>
            <p>Latest 50 Whop memberships in this environment.</p>
          </div>
        </div>
        <div className="cms-saas__table-wrap">
          <table className="cms-saas__table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period end</th>
                <th>Renewal</th>
              </tr>
            </thead>
            <tbody>
              {data.memberships.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link prefetch={false} href={customerLink(m.user_id)}>
                      {m.email}
                    </Link>
                    <small>
                      <code>{m.id}</code>
                    </small>
                  </td>
                  <td>{m.code}</td>
                  <td>{m.status}</td>
                  <td>{m.period_end ? date(m.period_end) : '—'}</td>
                  <td>
                    {m.cancel_at_period_end
                      ? 'Cancellation scheduled'
                      : 'No scheduled cancellation'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.memberships.length && (
          <p className="cms-saas__empty">No memberships recorded.</p>
        )}
      </section>
      <section className="cms-saas__panel">
        <div className="cms-saas__panel-head">
          <div>
            <h2>Open checkouts</h2>
            <p>
              Oldest 25 awaiting completion or review. An open checkout does not
              prove that payment failed.
            </p>
          </div>
        </div>
        <div className="cms-saas__table-wrap">
          <table className="cms-saas__table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Offer</th>
                <th>State</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.checkouts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link prefetch={false} href={customerLink(c.user_id)}>
                      {c.email}
                    </Link>
                    <small>
                      <code>{c.id}</code>
                    </small>
                  </td>
                  <td>{c.code}</td>
                  <td>{c.state}</td>
                  <td>{date(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.checkouts.length && (
          <p className="cms-saas__empty">No open checkouts.</p>
        )}
      </section>
      {!customer && (
        <section className="cms-saas__panel">
          <div className="cms-saas__panel-head">
            <div>
              <h2>Webhook delivery queue</h2>
              <p>
                Up to 30 unfinished events, highest retry counts first. Events
                with 30 attempts require investigation; others retry
                automatically.
              </p>
            </div>
          </div>
          <div className="cms-saas__table-wrap">
            <table className="cms-saas__table">
              <thead>
                <tr>
                  <th>Event / resource</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Attempts</th>
                  <th>Next retry / lease expiry</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <code>{e.id}</code>
                      <small>{e.resource_id}</small>
                    </td>
                    <td>{e.type}</td>
                    <td>{e.state}</td>
                    <td>
                      {e.attempts}
                      {e.attempts >= 30 && (
                        <small className="cms-saas__warning">
                          Needs investigation
                        </small>
                      )}
                    </td>
                    <td>
                      {e.attempts >= 30
                        ? 'Automatic retries exhausted'
                        : date(e.next_attempt_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.events.length && (
            <p className="cms-saas__empty">No unfinished webhook events.</p>
          )}
        </section>
      )}
    </section>
  );
}
