import { FaceSwapShowcase } from '@/components/face-swap-showcase';
import Link from 'next/link';
import { pageMetadata, absoluteUrl, serializeJsonLd } from '@/lib/seo';
import { PhotoPossibilities, PhotoIdeas, PhotoEditingExplainer, HomeQualityGuide, HomeFaq } from '@/components/home-content';
import { StudioInvitation } from '@/components/site-shell';
import { ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Layers, ImagePlus, Zap } from '@/components/icons';
import { SwapStudio } from '@/components/swap-studio';

export const metadata = pageMetadata('AI Face Swap Online for Photos | SwapThisFace', 'Create an AI face swap with your photos. Upload a source portrait and target image, compare the result, and download it. Try one successful swap free.', '/');

export default function Home() {
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd({'@context':'https://schema.org','@type':'WebSite','@id':absoluteUrl('/#website'),name:'SwapThisFace',alternateName:'SwapThisFace.com',url:absoluteUrl('/'),inLanguage:'en',publisher:{'@type':'Person',name:'Ibtihaj Uddin'}})}}/>
 <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> YOUR PHOTOS. YOUR CHOICE OF SCENE.</div><h1>AI Face Swap<br /><span className="serif-word">Online.</span><span className="headline-spark" aria-hidden="true">✳</span></h1><p className="hero-description">Put your face into a photo you choose. Upload your portrait and a target image, create an AI face swap, then compare and download the result—all in your browser.</p><StudioInvitation /><div className="hero-benefits"><span><ShieldCheck size={16} /> Uploads aren’t public</span><span><Zap size={16} /> No app to install</span></div></div>
 <FaceSwapShowcase /></section>
 <section className="studio-section" id="studio"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">UPLOAD YOUR PHOTOS</div><h2>Try the AI face swap tool<span className="lime-text">.</span></h2></div><p>Your portrait supplies the face. Your target supplies the scene.</p></div><SwapStudio /></div></section>
 <section className="how-section wrap"><div className="section-heading"><div><div className="eyebrow">FROM UPLOAD TO DOWNLOAD</div><h2>How to use AI face swap online.</h2></div><Link className="text-link" href="/blog/how-to-swap-a-face-between-two-photos">How to replace a face in an existing photo <ArrowUpRight size={17} /></Link></div><div className="steps-grid"><Step number="01" icon={<ImagePlus />} title="Start with your face" text="Choose a clear, front-facing photo. Good light makes a good starting point." /><Step number="02" icon={<Layers />} title="Choose the target photo" text="Upload the picture you want to appear in. Use a photo with clear, unobstructed faces." /><Step number="03" icon={<Sparkles />} title="Compare and download" text="Generate your swap, inspect the face and surrounding details, then save the finished photo." /></div></section>
 <PhotoPossibilities /><PhotoIdeas /><HomeQualityGuide /><PhotoEditingExplainer /><HomeFaq /><section className="bottom-cta wrap"><div><div className="eyebrow">READY TO TRY YOUR PHOTOS?</div><h2>Create your AI face swap.</h2><p>Choose your portrait and a target photo. Compare the result before you save it.</p></div><Link href="/face-swap" className="button button-dark">Open the face swap tool <ArrowRight size={18} /></Link></section>
 </>;
}
function Step({number,icon,title,text}:{number:string;icon:React.ReactNode;title:string;text:string}) { return <article className="step-card"><div className="step-top"><span className="step-icon">{icon}</span><span className="step-number">{number}</span></div><h3>{title}</h3><p>{text}</p></article>; }
