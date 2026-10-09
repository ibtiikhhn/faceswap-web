import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { listOwnerSaasOverview, listOwnerOperations } from '@/cms/owner-services'

function numberFormat(value: number) {
  return new Intl.NumberFormat('en').format(value)
}

function dateFormat(value: string | null) {
  if (!value) return 'Active'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export default async function SaaSOverview({ searchParams, initPageResult }: AdminViewServerProps) {
  const user = initPageResult.req.user
  if (!user) redirect('/admin/login')
  const [overview, operations] = await Promise.all([listOwnerSaasOverview(), listOwnerOperations()])
  const updated = searchParams?.updated === 'credits' ? 'Credits granted and audited in the ledger.' : searchParams?.updated === 'account' ? 'Account access updated and audited.' : null
  const error = typeof searchParams?.error === 'string' ? searchParams.error : null

  return (
    <main className="cms-saas">
      <header className="cms-saas__header">
        <div>
          <p className="cms-saas__eyebrow">Owner admin</p>
          <h1>SaaS overview</h1>
        </div>
        <p className="cms-saas__owner">Signed in as {user?.email ?? 'owner'}</p>
      </header>

      {updated ? <div className="cms-saas__notice">{updated}</div> : null}
      {!operations.auditReady && <div className="cms-saas__notice">Account access controls need the latest database migration. Run npm run db:migrate.</div>}
      {error ? <div className="cms-saas__error">{error}</div> : null}

      <section className="cms-saas__metrics" aria-label="SaaS metrics">
        <div>
          <span>Users</span>
          <strong>{numberFormat(overview.totals.users)}</strong>
        </div>
        <div>
          <span>Available credits</span>
          <strong>{numberFormat(overview.totals.creditsAvailable)}</strong>
        </div>
        <div>
          <span>Swaps</span>
          <strong>{numberFormat(overview.totals.swapsTotal)}</strong>
        </div>
        <div>
          <span>Failed swaps</span>
          <strong>{numberFormat(overview.totals.swapsFailed)}</strong>
        </div>
      </section>

      <section className="cms-saas__panel">
        <div className="cms-saas__panel-head">
          <div>
            <p className="cms-saas__eyebrow">Customers</p>
            <h2>Manage users and credits</h2>
          </div>
          <p>Showing the latest 100 accounts. Manual credit grants require a reason and are written to the credit ledger with the owner identity.</p>
        </div>

        <div className="cms-saas__table-wrap">
          <table className="cms-saas__table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Credits</th>
                <th>Swaps</th>
                <th>Grant credits</th>
              </tr>
            </thead>
            <tbody>
              {overview.users.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.email}</strong>
                    <span>{customer.name ?? customer.id}</span>
                  </td>
                  <td>{customer.suspendedAt ? `Suspended ${dateFormat(customer.suspendedAt)}` : 'Active'}
                    <form method="post" action="/api/owners/saas/suspension" className="cms-saas__grant">
                      <input type="hidden" name="userId" value={customer.id}/>
                      <input type="hidden" name="action" value={customer.suspendedAt ? 'restore' : 'suspend'}/>
                      <input name="reason" required minLength={4} maxLength={240} placeholder="Reason for access change"/>
                      <button type="submit" disabled={!operations.auditReady}>{customer.suspendedAt ? 'Restore access' : 'Suspend access'}</button>
                    </form>
                  </td>
                  <td>
                    {numberFormat(customer.creditsAvailable)}
                    {customer.creditsReserved ? <span>{numberFormat(customer.creditsReserved)} reserved</span> : null}
                  </td>
                  <td>
                    {numberFormat(customer.swapsTotal)}
                    <span>
                      {numberFormat(customer.swapsSucceeded)} succeeded, {numberFormat(customer.swapsFailed)} failed
                    </span>
                  </td>
                  <td>
                    <form className="cms-saas__grant" method="post" action="/api/owners/saas/credits">
                      <input type="hidden" name="userId" value={customer.id} />
                      <input name="amount" type="number" min="1" max="10000" step="1" placeholder="Amount" required />
                      <input name="reason" type="text" minLength={4} maxLength={240} placeholder="Reason" required />
                      <button type="submit">Grant</button>
                    </form>
                  </td>
                </tr>
              ))}
              {overview.users.length === 0 ? (
                <tr>
                  <td colSpan={5}>No customer accounts have been created yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="cms-saas__panel">
        <h2>Recent subscriptions</h2>
        <p>Payments are disabled while Paddle integration is pending. Suspending app access does not cancel a subscription.</p>
        <div className="cms-saas__table-wrap"><table className="cms-saas__table"><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Paid through</th></tr></thead><tbody>
          {operations.subscriptions.map(s => <tr key={s.id}><td>{s.email}</td><td>{s.plan_code ?? 'Unassigned'}</td><td>{s.status}{s.cancel_at_period_end ? ' · ends at period end' : ''}</td><td>{s.paid_current_period_end ? dateFormat(s.paid_current_period_end) : 'Not confirmed'}</td></tr>)}
          {!operations.subscriptions.length && <tr><td colSpan={4}>No subscriptions yet.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="cms-saas__panel">
        <h2>Latest 50 swap jobs</h2>
        <div className="cms-saas__table-wrap"><table className="cms-saas__table"><thead><tr><th>Job</th><th>Customer</th><th>Status</th><th>Created</th></tr></thead><tbody>
          {operations.jobs.map(j => <tr key={j.id}><td>{j.id}<span>{j.mode}</span></td><td>{j.email ?? 'Guest'}</td><td>{j.state}<span>{j.error_message}</span></td><td>{dateFormat(j.created_at)}</td></tr>)}
          {!operations.jobs.length && <tr><td colSpan={4}>No jobs yet.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="cms-saas__panel">
        <h2>Recent access changes</h2>
        {operations.audit.map(a => <p key={a.id}>{a.action} · {a.email ?? 'Deleted account'} · {a.reason} · owner {a.owner_id} · {dateFormat(a.created_at)}</p>)}
        {!operations.audit.length && <p>No access changes yet.</p>}
      </section>
    </main>
  )
}
