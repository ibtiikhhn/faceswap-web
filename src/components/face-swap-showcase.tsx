'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Sparkles } from './icons';

const examples = [
  { id: 'coast', label: 'Coastal escape', scene: 'A boat trip along a tropical coastline', note: 'Same scene. A new you.' },
  { id: 'paris', label: 'A day in Paris', scene: 'A portrait beside the Eiffel Tower', note: 'Your face. A different story.' },
  { id: 'city', label: 'City afternoons', scene: 'An outdoor café beneath a historic tower', note: 'Make the moment your own.' },
];

export function FaceSwapShowcase() {
  const [selected, setSelected] = useState(0);
  const [position, setPosition] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const phase = useRef(0);
  const example = examples[selected];
  const ready = loaded.includes(`${example.id}-target`) && loaded.includes(`${example.id}-result`);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPlaying(!motion.matches);
    const preferenceChanged = () => { setPlaying(!motion.matches); setPosition(100); phase.current = 0; };
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    motion.addEventListener('change', preferenceChanged);
    return () => { observer.disconnect(); motion.removeEventListener('change', preferenceChanged); };
  }, []);

  useEffect(() => {
    if (!playing || !visible || !ready) return;
    let frame = 0;
    let previous = 0;
    const animate = (now: number) => {
      if (!document.hidden) {
        if (previous) phase.current += Math.min(now - previous, 50);
        const time = phase.current % 10000;
        // Hold both ends so visitors can actually study the original and result.
        const progress = time < 1500 ? 0 : time < 4500 ? (time - 1500) / 3000 : time < 7000 ? 1 : (10000 - time) / 3000;
        setPosition((0.5 - Math.cos(progress * Math.PI) / 2) * 100);
      }
      previous = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible, ready, selected]);

  function choose(index: number) { setSelected(index); phase.current = 0; setPosition(playing ? 0 : 100); }
  function imageLoaded(key: string) { setLoaded(current => current.includes(key) ? current : [...current, key]); }

  return <div className="swap-showcase" ref={root} aria-label="Photo face swap examples">
    <div className="showcase-topline"><span><span className="status-dot" /> TWO PHOTOS. ONE NEW LOOK.</span><span className="showcase-index">0{selected + 1} / 03</span></div>
    <div className="showcase-stage">
      <div className="showcase-orbit" aria-hidden="true" />
      <div className="showcase-source"><div className="showcase-source-photo"><img src="/images/examples/source.webp" width="320" height="400" alt="Source selfie used in all three face swap examples" /></div><div className="showcase-source-caption"><span className="showcase-number">01</span><span>Your face</span></div></div>
      <span className="showcase-connector" aria-hidden="true"><ArrowUpRight size={30}/></span>
      <div className="showcase-comparison">
        <div className="showcase-photo-stack">
          <img key={`${example.id}-target`} className="showcase-photo" src={`/images/examples/${example.id}-target.webp`} width="900" height="1125" alt={`Target photo: ${example.scene}`} fetchPriority={selected === 0 ? 'high' : 'auto'} onLoad={() => imageLoaded(`${example.id}-target`)} />
          <img key={`${example.id}-result`} className="showcase-photo showcase-result" src={`/images/examples/${example.id}-result.webp`} width="900" height="1125" alt={`Face swap result: the source person's face in ${example.scene.toLowerCase()}`} style={{clipPath: `inset(0 ${100 - position}% 0 0)`}} onLoad={() => imageLoaded(`${example.id}-result`)} />
          <div className="showcase-photo-labels" aria-hidden="true"><span style={{opacity: position > 20 ? 1 : 0}}>YOUR RESULT</span><span style={{opacity: position < 80 ? 1 : 0}}>TARGET PHOTO</span></div>
          <div className="showcase-divider" style={{left: `${position}%`, opacity: position > 1 && position < 99 ? 1 : 0}} aria-hidden="true"><span>‹ ›</span></div>
          <input className="showcase-scrubber" type="range" min="0" max="100" value={Math.round(position)} aria-label="Compare target photo and face swap result" aria-valuetext={`${Math.round(position)} percent result revealed`} onPointerDown={() => setPlaying(false)} onKeyDown={() => setPlaying(false)} onChange={event => { setPlaying(false); setPosition(Number(event.target.value)); }} />
        </div>
        <div className="showcase-result-caption"><div><Sparkles size={16}/><span>{example.note}</span></div><span className="showcase-number">02 → 03</span></div>
      </div>
      <span className="showcase-sticker" aria-hidden="true">Your next<br/><i>what if?</i> ✳</span>
    </div>
    <div className="showcase-controls"><p>Drag across the photo to compare</p><button type="button" onClick={() => { phase.current = 0; setPlaying(value => !value); }} aria-label={playing ? 'Pause face swap animation' : 'Play face swap animation'}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? 'Pause' : 'Play'}</button></div>
    <div className="showcase-scenes" role="group" aria-label="Choose an example scene">{examples.map((item, index) => <button type="button" key={item.id} className={index === selected ? 'is-selected' : ''} aria-pressed={index === selected} onClick={() => choose(index)}><img src={`/images/examples/${item.id}-thumb.webp`} width="40" height="44" alt="" loading="lazy" /><span>{item.label}</span></button>)}</div>
    <p className="showcase-disclosure">Example face swaps · Results vary with your photos.</p>
  </div>;
}
