'use client';

import { useState } from 'react';

const goals = [
  { id: 'auto', label: 'Let the tool choose', title: 'Use the automatic group-photo workflow', text: 'Upload one clear source portrait and your group target. The tool chooses whichever faces fit best. Review the result to see who changed.', fit: true },
  { id: 'person', label: 'Change one specific person', title: 'This needs individual face selection', text: 'You cannot point to a person or lock the other faces here. A result may change only one face, but the selection is automatic. Choose a tool with manual face selection if that exact person must change.', fit: false },
  { id: 'different', label: 'Give everyone a different face', title: 'This needs a source for each person', text: 'There is one source-image upload here. Separate replacements for each person require individual source uploads and assignment controls, which this editor does not offer.', fit: false },
] as const;

export function GroupSwapGuide() {
  const [selected, setSelected] = useState<(typeof goals)[number]['id']>('auto');
  const goal=goals.find(item=>item.id===selected)!;
  return <div className="multi-fit"><fieldset><legend>What would you like to change?</legend><div className="multi-fit-options">{goals.map(item=><label key={item.id} className={selected===item.id?'is-selected':''}><input type="radio" name="group-swap-goal" value={item.id} checked={selected===item.id} onChange={()=>setSelected(item.id)}/><span>{item.label}</span></label>)}</div></fieldset><div className="multi-fit-answer" aria-live="polite"><h3>{goal.title}</h3><p>{goal.text}</p>{goal.fit&&<a href="#group-editor" className="text-link">Upload your two photos →</a>}</div></div>;
}
