'use client';

import { useState } from 'react';
import Link from 'next/link';

const checks = [
  { label: 'One visible face in each photo', advice: 'Choose a single-person target and a source portrait. Group face mapping is not supported by this editor.' },
  { label: 'Both faces are sharp at their original size', advice: 'Use the original image rather than a screenshot. A large file can still contain a tiny or blurred face.' },
  { label: 'Head angles and expressions are similar', advice: 'Match a turned target with a similarly turned source. A relaxed mouth is easier to compare with another relaxed mouth than an exaggerated smile.' },
  { label: 'Eyes, nose and mouth are unobstructed', advice: 'Try a photo without dark glasses, hands across the mouth, or hair hiding the eyes.' },
  { label: 'Lighting and color are reasonably compatible', advice: 'Avoid pairing a brightly lit face with a target in deep shadow. Try inputs without strong color filters.' },
];

export function PhotoReadinessChecklist() {
  const [selected, setSelected] = useState<boolean[]>(checks.map(() => false));
  const remaining = checks.filter((_, index) => !selected[index]);
  return <section className="panel readiness" aria-labelledby="readiness-title">
    <h2 id="readiness-title">Check your photo pair before uploading</h2>
    <p>Use this self-check while looking at your two photos. It does not scan your images or predict a quality score.</p>
    <fieldset><legend>Which statements describe your photos?</legend>{checks.map((check, index) => <label key={check.label}><input type="checkbox" checked={selected[index]} onChange={event => setSelected(current => current.map((value, i) => i === index ? event.target.checked : value))}/><span>{check.label}</span></label>)}</fieldset>
    <div aria-live="polite"><h3>{remaining.length ? 'What to check next' : 'Your inputs are ready to try'}</h3>{remaining.length ? <p>{remaining[0].advice}</p> : <p>These checks remove common input problems, but they cannot guarantee the result. Generate a swap, then review it at full size.</p>}</div>
    <Link className="button button-dark" href="/face-swap">Open the photo face swap editor</Link>
  </section>;
}
