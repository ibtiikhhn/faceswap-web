'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerActions({
  userId,
  suspended,
  auditReady,
}: {
  userId: string;
  suspended: boolean;
  auditReady: boolean;
}) {
  const router = useRouter();
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<{
    kind: string;
    data: FormData;
    label: string;
  } | null>(null);
  function prepare(event: FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage('');
    setConfirmation({
      kind,
      data,
      label:
        kind === 'credits'
          ? `Grant ${data.get('amount')} credits to this customer?`
          : suspended
            ? 'Restore this customer’s access?'
            : 'Suspend this customer and sign them out?',
    });
  }
  async function submit() {
    if (!confirmation || pending) return;
    setPending(true);
    setMessage('');
    try {
      const body =
        confirmation.kind === 'credits'
          ? JSON.stringify({
              userId,
              requestKey,
              amount: Number(confirmation.data.get('amount')),
              reason: confirmation.data.get('reason'),
            })
          : confirmation.data;
      const response = await fetch(`/api/owners/saas/${confirmation.kind}`, {
        method: 'POST',
        body,
        headers:
          confirmation.kind === 'credits'
            ? { 'Content-Type': 'application/json' }
            : { Accept: 'application/json' },
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || 'The change could not be saved.',
        );
      setRequestKey(crypto.randomUUID());
      setConfirmation(null);
      setMessage('Saved. The customer record has been updated.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The change could not be saved.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="cms-saas__actions">
      <form className="cms-saas__form" onSubmit={(e) => prepare(e, 'credits')}>
        <h3>Grant credits</h3>
        <label>
          Amount
          <input
            name="amount"
            type="number"
            min="1"
            max="10000"
            step="1"
            required
            disabled={pending}
          />
        </label>
        <label>
          Reason
          <input
            name="reason"
            minLength={4}
            maxLength={240}
            required
            disabled={pending}
          />
        </label>
        <button disabled={pending}>Review credit grant</button>
        <small>Reason and owner identity are recorded in the ledger.</small>
      </form>
      <form
        className="cms-saas__form"
        onSubmit={(e) => prepare(e, 'suspension')}
      >
        <h3>{suspended ? 'Restore account' : 'Suspend account'}</h3>
        <input type="hidden" name="userId" value={userId} />
        <input
          type="hidden"
          name="action"
          value={suspended ? 'restore' : 'suspend'}
        />
        <label>
          Reason
          <input
            name="reason"
            minLength={4}
            maxLength={240}
            required
            disabled={pending}
          />
        </label>
        <button
          className="cms-saas__secondary"
          disabled={pending || !auditReady}
        >
          Review access change
        </button>
        <small>
          Changes app access only; billing continues.{' '}
          {!auditReady && 'Owner-audit migration required.'}
        </small>
      </form>
      {confirmation && (
        <div
          className="cms-saas__confirmation"
          role="region"
          aria-label="Confirm customer change"
        >
          <strong>{confirmation.label}</strong>
          <p>Reason: {String(confirmation.data.get('reason'))}</p>
          <button type="button" disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : 'Confirm change'}
          </button>{' '}
          <button
            type="button"
            className="cms-saas__secondary"
            disabled={pending}
            onClick={() => setConfirmation(null)}
          >
            Go back
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="cms-saas__notice">
          {message}
        </p>
      )}
    </div>
  );
}
