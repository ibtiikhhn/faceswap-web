import { FaceSwapShowcase } from '@/components/face-swap-showcase';
import Link from 'next/link';
import { pageMetadata, absoluteUrl, serializeJsonLd } from '@/lib/seo';
import { PhotoSwapGuide } from '@/components/photo-swap-guide';
import { PhotoPossibilities, PhotoIdeas, PhotoEditingExplainer, HomeFaq } from '@/components/home-content';
import { StudioInvitation } from '@/components/site-shell';
import { ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Layers, ImagePlus, Zap } from '@/components/icons';
import { SwapStudio } from '@/components/swap-studio';

export const metadata = pageMetadata('AI Photo Face Swap Online — Try 1 Free', 'Put your face on another picture with our AI photo face swap editor. Upload two photos, compare your result, and try one free swap without signing up.', '/');

export default function Home() {
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd({'@context':'https://schema.org','@type':'WebSite','@id':absoluteUrl('/#website'),name:'SwapThisFace.com',alternateName:'SwapThisFace',url:absoluteUrl('/'),inLanguage:'en',publisher:{'@type':'Person',name:'Ibtihaj Uddin'}})}}/>
 <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> PHOTO FACE SWAP ONLINE</div><h1>Recreate any photo<br />with <span className="serif-word">your face.</span><span className="headline-spark" aria-hidden="true">✳</span></h1><p className="hero-description">Your selfie. A photo you love. A whole new look. Use our AI photo face swap editor to recreate travel shots, portraits, and more with your face.</p><StudioInvitation /><div className="hero-benefits"><span><ShieldCheck size={16} /> Private by default</span><span><Zap size={16} /> A few simple steps</span></div></div>
 <FaceSwapShowcase /></section>
 <section className="studio-section" id="studio"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">THE CREATIVE PART</div><h2>Your photo face swap starts here<span className="lime-text">.</span></h2></div><p>Two photos. One fresh perspective.</p></div><SwapStudio /></div></section>
 <section className="how-section wrap"><div className="section-heading"><div><div className="eyebrow">LESS WORK. MORE WHAT-IF.</div><h2>How to swap a face in another photo.</h2></div><Link className="text-link" href="/face-swap">Open the studio <ArrowUpRight size={17} /></Link></div><div className="steps-grid"><Step number="01" icon={<ImagePlus />} title="Start with your face" text="Choose a clear, front-facing photo. Good light makes a good starting point." /><Step number="02" icon={<Layers />} title="Pick a new perspective" text="Upload the photo you want to step into. Choose an image with one visible face." /><Step number="03" icon={<Sparkles />} title="Make it your own" text="Create your swap, compare the result, and download it. Keep exploring from your studio." /></div></section>
 <PhotoPossibilities /><PhotoIdeas /><div className="wrap"><PhotoSwapGuide /></div><PhotoEditingExplainer /><HomeFaq /><section className="bottom-cta wrap"><div><div className="eyebrow">GO ON. GET CURIOUS.</div><h2>A new look is a photo away.</h2><p>Bring two photos and explore your next look.</p></div><Link href="/face-swap" className="button button-dark">Let’s create <ArrowRight size={18} /></Link></section>
 </>;
}
function Step({number,icon,title,text}:{number:string;icon:React.ReactNode;title:string;text:string}) { return <article className="step-card"><div className="step-top"><span className="step-icon">{icon}</span><span className="step-number">{number}</span></div><h3>{title}</h3><p>{text}</p></article>; }
