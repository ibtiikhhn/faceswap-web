import { SwapStudio } from '@/components/swap-studio';
import { PhotoSwapFaq } from '@/components/photo-swap-guide';
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata('Face Swap Photo Editor Online', 'Upload a source face and a target photo in our online face swap editor. JPG, PNG, and WebP supported. One guest trial; subscription required afterward.', '/face-swap');
export default function FaceSwap(){return <div className="wrap studio-page"><div className="page-header"><div className="eyebrow"><span className="status-dot"/>TWO PHOTOS. ONE NEW LOOK.</div><h1>Face swap photo editor.</h1><p>Upload your face and a target photo. Create, compare, and download your result from your browser.</p></div><SwapStudio /><PhotoSwapFaq /></div>;}
