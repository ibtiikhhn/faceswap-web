import { FaceSwapShowcase } from '@/components/face-swap-showcase';
import Link from 'next/link';
import { pageMetadata, absoluteUrl, serializeJsonLd } from '@/lib/seo';
import { PhotoSwapGuide } from '@/components/photo-swap-guide';
import { PhotoPossibilities, PhotoIdeas, PhotoEditingExplainer, HomeFaq } from '@/components/home-content';
import { StudioInvitation } from '@/components/site-shell';
import { ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Layers, ImagePlus, Zap } from '@/components/icons';
import { SwapStudio } from '@/components/swap-studio';

export const metadata = pageMetadata('AI Face Swap Online – Put Your Face in Any Photo', 'Recreate photos with your face using AI. Try a travel shot, a new portrait or a different look. Your first photo face swap is free, with no signup needed.', '/');

export default function Home() {
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd({'@context':'https://schema.org','@type':'WebSite','@id':absoluteUrl('/#website'),name:'SwapThisFace',alternateName:'SwapThisFace.com',url:absoluteUrl('/'),inLanguage:'en',publisher:{'@type':'Person',name:'Ibtihaj Uddin'}})}}/>
 <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> PHOTO FACE SWAP ONLINE</div><h1>Recreate any photo<br />with <span className="serif-word">your face.</span><span className="headline-spark" aria-hidden="true">✳</span></h1><p className="hero-description">Turn a photo you love into a moment starring you. Upload your selfie and swap faces in travel shots, portraits, and more with AI.</p><StudioInvitation /><div className="hero-benefits"><span><ShieldCheck size={16} /> Private by default</span><span><Zap size={16} /> A few simple steps</span></div></div>
 <FaceSwapShowcase /></section>
 <section className="studio-section" id="studio"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">THE CREATIVE PART</div><h2>Your photo face swap starts here<span className="lime-text">.</span></h2></div><p>Two photos. One fresh perspective.</p></div><SwapStudio /></div></section>
 <section className="how-section wrap"><div className="section-heading"><div><div className="eyebrow">LESS WORK. MORE WHAT-IF.</div><h2>How to swap a face in another photo.</h2></div><Link className="text-link" href="/blog/how-to-swap-a-face-between-two-photos">Read the step-by-step guide <ArrowUpRight size={17} /></Link></div><div className="steps-grid"><Step number="01" icon={<ImagePlus />} title="Start with your face" text="Choose a clear, front-facing photo. Good light makes a good starting point." /><Step number="02" icon={<Layers />} title="Pick a new perspective" text="Upload the photo you want to step into. Choose an image with one visible face." /><Step number="03" icon={<Sparkles />} title="Make it your own" text="Create your swap, compare the result, and download it. Keep exploring from your studio." /></div></section>
 <PhotoPossibilities /><PhotoIdeas /><div className="wrap"><PhotoSwapGuide /></div><PhotoEditingExplainer /><HomeFaq /><section className="bottom-cta wrap"><div><div className="eyebrow">GO ON. GET CURIOUS.</div><h2>A new look is a photo away.</h2><p>Bring two photos and explore your next look.</p></div><Link href="/face-swap" className="button button-dark">Let’s create <ArrowRight size={18} /></Link></section>
 </>;
}
function Step({number,icon,title,text}:{number:string;icon:React.ReactNode;title:string;text:string}) { return <article className="step-card"><div className="step-top"><span className="step-icon">{icon}</span><span className="step-number">{number}</span></div><h3>{title}</h3><p>{text}</p></article>; }
