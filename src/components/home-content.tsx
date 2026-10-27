import Link from 'next/link';
import { ArrowUpRight, ImagePlus, Layers, Sparkles } from './icons';

export function PhotoPossibilities() {
  return <section className="home-editorial wrap" aria-labelledby="put-your-face-title">
    <div className="editorial-intro">
      <div><div className="eyebrow">YOUR FACE. A DIFFERENT SETTING.</div><h2 id="put-your-face-title">Put your face on another picture.</h2></div>
      <div><p>Recreate a travel photo, try a new portrait style, or put yourself into a costume shot. An AI photo face swap takes the face from your source image and places it into a target picture. Start with a clear photo of yourself and a target picture you have permission to edit.</p><p>The source photo supplies the face. The target photo supplies the scene you want to step into. Choose a target with one visible face and a similar head angle for a better starting point.</p><Link href="/face-swap" className="text-link">Choose your two photos <ArrowUpRight size={16}/></Link></div>
    </div>
    <div className="photo-roles" aria-label="Which photos to choose">
      <div className="photo-role"><ImagePlus size={24}/><div><span className="eyebrow">SOURCE PHOTO</span><h3>The face you want to use</h3><p>A sharp selfie or portrait with your eyes, nose, and mouth clearly visible. Skip heavy filters and anything covering your face.</p></div></div>
      <div className="photo-role"><Layers size={24}/><div><span className="eyebrow">TARGET PHOTO</span><h3>The photo you want to recreate</h3><p>Choose the composition, outfit, and setting you like. The face should be large enough to see clearly, with one person as the subject.</p></div></div>
    </div>
  </section>;
}

const ideas = [
  { number: '01', title: 'Recreate a travel photo', text: 'Try your face in a city portrait or a coastal scene, like the examples above. Use a target image you have permission to edit, and choose a face angle that matches your selfie.', tip: 'Start with a similar head angle.' },
  { number: '02', title: 'Step into a costume photo', text: 'Plan a playful character portrait using a costume image you own or have permission to edit. Pick the outfit in the target image before swapping the face.', tip: 'Keep hats and props clear of the face.' },
  { number: '03', title: 'Explore a vintage-inspired look', text: 'Use a retro-styled portrait as your target to explore a different era. A face swap changes who appears in the picture; it does not restore damaged photographs.', tip: 'Use a sharp, undamaged reference.' },
  { number: '04', title: 'Personalize a photo card', text: 'Prepare an image for a birthday greeting, a seasonal card, or a lighthearted gift. Choose a single-person picture and keep any existing card text away from the face.', tip: 'Review the result before sharing.' },
];

export function PhotoIdeas() {
  return <section className="home-ideas" aria-labelledby="photo-ideas-title"><div className="wrap">
    <div className="section-heading"><div><div className="eyebrow">FIND YOUR NEXT PHOTO IDEA</div><h2 id="photo-ideas-title">Recreate a photo with your face.</h2></div><p>Four ways to choose a target image.</p></div>
    <p className="guide-intro">Think of the photo you want to make before choosing your inputs. Use these ideas to choose a single-person target photo; the interactive examples above show how the source face and target scene work together.</p>
    <div className="photo-ideas-grid">{ideas.map(idea => <article className="photo-idea" key={idea.number}><span className="idea-number">{idea.number}</span><h3>{idea.title}</h3><p>{idea.text}</p><div className="idea-tip"><Sparkles size={15}/>{idea.tip}</div></article>)}</div>
  </div></section>;
}

export function PhotoEditingExplainer() {
  return <section className="home-editorial wrap" aria-labelledby="photo-editing-title"><div className="editorial-intro">
    <div><div className="eyebrow">KNOW WHAT YOU’RE CHANGING</div><h2 id="photo-editing-title">A face swap starts with two photos, not a prompt.</h2></div>
    <div><p>In an AI photo face swap, you provide a source face and an existing target image. You do not need to describe a new scene in a text prompt. Choosing the right target is how you choose the composition, clothing, and background you want to work with.</p><p>If you want a different outfit or setting, start with a different target photo. This editor does not provide background replacement, body reshaping, photo animation, or a tool for generating an entirely new scene.</p><p>Think of a realistic face swap as a question of fit: does the face belong with the pose, lighting, and expression in the target? Compare the result with the original and check the eyes, hairline, and edges before you download or share it.</p></div>
  </div><div className="home-privacy-note"><ShieldNote/><div><h3>Your photo choices stay in your control.</h3><p>Customer uploads are not posted to a public gallery. Originals expire 24 hours after upload; account results are retained for 30 days and guest results for 24 hours. Download anything you want to keep, and read the <Link href="/privacy">photo retention and deletion details</Link>.</p></div></div></section>;
}
function ShieldNote(){return <span className="privacy-note-icon"><ImagePlus size={23}/></span>;}

const homeQuestions = [
  { question: 'How do I put my face on another picture?', answer: <>Upload a clear selfie as your source photo, then upload the picture you want to appear in as your target. Use one visible face in each image. Create the swap in the <Link href="/face-swap">online face swap editor</Link>, compare the result, and download the version you want to keep.</> },
  { question: 'Can I swap a face from one photo to another without Photoshop?', answer: <>Yes. SwapThisFace.com works with two uploaded photos in your browser. You do not need to cut out a face, build layers, or install Photoshop. The target supplies the composition and setting; the source supplies the face.</> },
  { question: 'Can I try an AI face swap online free without signing up?', answer: <>You can try one successful photo face swap without creating an account. After the trial, sign in with Google and choose a subscription or a standalone credit pack. The trial does not enroll you in a paid plan, and free access is not unlimited. See <Link href="/pricing">plans and credit packs</Link>.</> },
  { question: 'How do I get a realistic face swap?', answer: <>Choose sharp photos with similar head angles and lighting. Keep eyes, nose, and mouth visible; avoid sunglasses, strong shadows, and heavy beauty filters. Inspect the eyes, skin tone, and face edges at full size before sharing. The examples show possible results, not a guarantee for every pair of photos.</> },
  { question: 'Why does my face swap look blurry or unnatural?', answer: <>A face that is tiny, blurred, partly covered, or turned away gives the model less detail to work with. Start with the original photo rather than a compressed screenshot, then try a target with a closer head angle. Stretching a small image does not restore missing detail. Changing either input can help, but results still depend on the processing model.</> },
  { question: 'Can I swap faces on iPhone or Android without an app?', answer: <>Yes. Open the website in your mobile browser and choose the two photos from your device. No app or APK download is required. Use JPG, PNG, or WebP images up to 10 MB each; export HEIC photos to a supported format before uploading.</> },
  { question: 'Can I recreate any photo with my face?', answer: <>You can choose a photo you have permission to edit, but not every image will work well. A clear, single-person portrait is a better starting point than a group shot, a distant face, or a face hidden by hair or props. Choose your target for the outfit and scene you want.</> },
  { question: 'Can I swap a face and keep the target pose and background?', answer: <>The target photo supplies the outfit, pose, and background. This editor does not offer separate clothing or background-generation controls. Choose a different target photo to try a different look, and review the finished result for unintended changes.</> },
  { question: 'Can I swap multiple faces in a group photo or use video?', answer: <>This version supports a source face photo and a target photo with one visible face each. Multiple-face swaps, video, GIFs, and live calls are not supported. For the current workflow, choose two single-face images.</> },
  { question: 'Are my uploaded face photos public?', answer: <>Customer uploads are not published in a public gallery. Images are processed through our service infrastructure and face-swap provider. Originals expire after 24 hours; account results are retained for 30 days and guest results for 24 hours. Only upload photos you have permission to use, and read our <Link href="/privacy">privacy and deletion details</Link> before uploading.</> },
];

export function HomeFaq() {
  return <section className="wrap home-faq" aria-labelledby="home-faq-title"><div className="home-faq-intro"><div className="eyebrow">BEFORE YOUR FIRST SWAP</div><h2 id="home-faq-title">Photo face swap FAQs.</h2><p>From your first two photos to a more realistic result: what to upload, how it works, and what to expect.</p><Link href="/face-swap" className="text-link">Try the photo face swap editor <ArrowUpRight size={16}/></Link></div><div className="faq home-faq-list">{homeQuestions.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>;
}
