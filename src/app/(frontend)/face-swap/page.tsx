import { SwapStudio } from '@/components/swap-studio';
import { PhotoSwapFaq } from '@/components/photo-swap-guide';
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata('Swap Faces Between Two Photos Online', 'Swap a face from one photo to another in your browser. Upload JPG, PNG, or WebP images and try one free photo face swap. No app download needed.', '/face-swap');
export default function FaceSwap(){return <div className="wrap studio-page"><div className="page-header"><div className="eyebrow"><span className="status-dot"/>TWO PHOTOS. ONE NEW LOOK.</div><h1>Swap faces between two photos.</h1><p>Choose a clear source face and a target photo with one person. Our online face swap photo editor lets you create, compare, and download the result on your phone or desktop.</p></div><SwapStudio /><PhotoSwapFaq /></div>;}
