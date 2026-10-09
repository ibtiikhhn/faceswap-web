import Link from 'next/link';
import { ArrowUpRight, ImagePlus, Layers, Sparkles } from './icons';

export function PhotoPossibilities() {
  return <section className="home-editorial wrap" aria-labelledby="put-your-face-title">
    <div className="editorial-intro">
      <div><div className="eyebrow">YOUR FACE. A DIFFERENT SETTING.</div><h2 id="put-your-face-title">Put your face in another photo.</h2></div>
      <div><p>Have a portrait, costume shot, or vintage-style picture you want to make your own? A photo face swap brings the face from one image into another. Start with a clear photo of yourself and a target picture you have permission to edit.</p><p>The source photo supplies the face. The target photo supplies the scene you want to step into. Choose a target with one visible face and a similar head angle for a better starting point.</p><Link href="/face-swap" className="text-link">Choose your two photos <ArrowUpRight size={16}/></Link></div>
    </div>
    <div className="photo-roles" aria-label="Which photos to choose">
      <div className="photo-role"><ImagePlus size={24}/><div><span className="eyebrow">SOURCE PHOTO</span><h3>The face you want to use</h3><p>A sharp selfie or portrait with your eyes, nose, and mouth clearly visible. Skip heavy filters and anything covering your face.</p></div></div>
      <div className="photo-role"><Layers size={24}/><div><span className="eyebrow">TARGET PHOTO</span><h3>The photo you want to recreate</h3><p>Choose the composition, outfit, and setting you like. The face should be large enough to see clearly, with one person as the subject.</p></div></div>
    </div>
  </section>;
}

const ideas = [
  { number: '01', title: 'Try a different portrait style', text: 'Explore a studio-style portrait, a dramatic close-up, or a casual outdoor scene. Choose a reference photo whose pose and lighting suit your source image.', tip: 'Start with a similar head angle.' },
  { number: '02', title: 'Step into a costume photo', text: 'Plan a playful character portrait using a costume image you own or have permission to edit. Pick the outfit in the target image before swapping the face.', tip: 'Keep hats and props clear of the face.' },
  { number: '03', title: 'Explore a vintage-inspired look', text: 'Use a retro-styled portrait as your target to explore a different era. A face swap changes who appears in the picture; it does not restore damaged photographs.', tip: 'Use a sharp, undamaged reference.' },
  { number: '04', title: 'Personalize a photo card', text: 'Prepare an image for a birthday greeting, a seasonal card, or a lighthearted gift. Choose a single-person picture and keep any existing card text away from the face.', tip: 'Review the result before sharing.' },
];

export function PhotoIdeas() {
  return <section className="home-ideas" aria-labelledby="photo-ideas-title"><div className="wrap">
    <div className="section-heading"><div><div className="eyebrow">FIND YOUR NEXT PHOTO IDEA</div><h2 id="photo-ideas-title">Recreate a photo with your face.</h2></div><p>Four ways to choose a target image.</p></div>
    <p className="guide-intro">Think of the photo you want to make before choosing your inputs. These are ideas for a single-face photo swap, not sample results from the current preview.</p>
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

export function HomeFaq() {
  return <section className="wrap home-faq" aria-labelledby="home-faq-title"><div className="home-faq-intro"><div className="eyebrow">BEFORE YOUR FIRST SWAP</div><h2 id="home-faq-title">Your photo face swap questions, answered.</h2><p>How it works, what to upload, and what to expect from your result.</p><Link href="/face-swap" className="text-link">Open the photo editor <ArrowUpRight size={16}/></Link></div><div className="faq home-faq-list">
    <details><summary>How can I put my face on another photo?</summary><p>Upload a clear photo of your face as the source, then choose the picture you want to appear in as the target. Both images should contain one visible face. Submit the job in the <Link href="/face-swap">online face swap editor</Link>, then compare and download the result. When the studio is in development preview mode, results are labeled mock previews rather than real face swaps.</p></details>
    <details><summary>Can I recreate any photo with my face?</summary><p>You can choose a target photo you have permission to edit, but not every image is a suitable match. A small, blurred, covered, or sharply turned face may be difficult to work with. This version is designed for single-face photos, so use a clear portrait rather than a group picture.</p></details>
    <details><summary>What is the difference between a face swap and a face filter?</summary><p>A face swap uses another photo as the source of the face. A filter typically changes the appearance of the existing photo, such as its colors or effects. This studio uses two uploaded images; it is not a live camera filter.</p></details>
    <details><summary>How do I get a more realistic face swap?</summary><p>Choose sharp source and target photos with similar face angles and lighting. Avoid strong shadows, sunglasses, and beauty filters that obscure facial detail. After processing, check the alignment and edges rather than judging only a small thumbnail. Photo selection can help, but final quality depends on the processing model; mock previews do not show the quality of a real swap.</p></details>
    <details><summary>Can I try a photo face swap for free without signing up?</summary><p>The guest offer is one successful swap without an account. In development preview mode, a successful mock preview uses that trial. Continued use requires Google sign-in, available subscription or purchased credits. It is not unlimited free access, and the trial does not automatically enroll you in a paid plan. See <Link href="/pricing">subscription and credit details</Link>.</p></details>
    <details><summary>Do I need Photoshop or an app download?</summary><p>No separate editor or app download is required for this workflow. Open the website in a desktop or mobile browser and select your two photos. Use JPG, PNG, or WebP files up to 10 MB each. Export HEIC images into a supported format before uploading.</p></details>
    <details><summary>Can I change the clothes or background too?</summary><p>Choose a target image that already contains the outfit and background you want. The planned face-swap workflow replaces the face; it does not offer separate controls to change clothing or generate a new background. Use a different target photo to explore a different setting.</p></details>
    <details><summary>Can I swap two faces in the same photo or use a video?</summary><p>Not in this version. The studio accepts a source face photo and a target photo with one face each. Multiple-face swaps, video face swaps, GIFs, and live calls are outside the current scope.</p></details>
    <details><summary>Can I use someone else’s photo for a face swap?</summary><p>Only use images you are entitled to edit, including permission from the people shown. A photo being publicly visible does not automatically give you permission to use it. Follow our <Link href="/terms">content and acceptable-use terms</Link>, and do not pass off a manipulated image as evidence of something that happened.</p></details>
  </div></section>;
}
