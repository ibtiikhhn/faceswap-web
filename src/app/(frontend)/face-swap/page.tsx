import Link from 'next/link';
import { findFaceSwapTemplate } from '@/lib/face-swap-templates';
import { SwapStudio } from '@/components/swap-studio';
import { PhotoSwapFaq, PhotoSwapWorkflow } from '@/components/photo-swap-guide';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Photo Face Swap — Swap Faces Between Photos | SwapThisFace', 'Create a photo face swap online with your own pictures. Upload a source portrait and target photo, compare the result, and download it in your browser.', '/face-swap');

export default async function FaceSwap({searchParams}:{searchParams:Promise<{template?:string}>}) {
  const {template}=await searchParams;
  const initialTarget=findFaceSwapTemplate(template);
  return <div className="wrap studio-page">
    <header className="page-header"><div className="eyebrow"><span className="status-dot"/>YOUR FACE. YOUR CHOICE OF PHOTO.</div><h1>Photo Face Swap</h1><p>Swap faces between two photos in your browser. Upload the face you want to use and the picture you want to appear in, then compare and download your result.</p></header>
    <SwapStudio key={initialTarget?.id ?? 'custom'} initialTarget={initialTarget}/>
    <PhotoSwapWorkflow/>
    <PhotoSwapFaq/>
    <section className="panel"><h2>Choose photos that work together</h2><p>A clear portrait and a target with a similar head angle give you a better starting point. Use the <Link href="/realistic-face-swap">realistic face swap guide</Link> to check lighting, expression and facial detail before your next attempt.</p><Link href="/templates" className="text-link">Choose a target from the photo templates</Link></section>
  </div>;
}
