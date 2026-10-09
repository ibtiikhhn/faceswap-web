import Link from 'next/link';
import { absoluteUrl, httpUrl, pageMetadata, serializeJsonLd } from '@/lib/seo';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { RichText } from '@payloadcms/richtext-lexical/react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { getPublishedPost, getBlogRedirect } from '@/server/cms';
import { ArrowLeft } from '@/components/icons';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props){
 const {slug}=await params; const {post}=await getPublishedPost(slug);
 if(!post)return {title:'Article not found',robots:{index:false,follow:false}};
 const title=post.seoTitle?.trim()||post.title; const description=post.seoDescription?.trim()||post.summary;
 const metadata=pageMetadata(title,description,`/blog/${encodeURIComponent(post.slug)}`);
 const canonical=httpUrl(post.canonicalUrl)??absoluteUrl(`/blog/${encodeURIComponent(post.slug)}`);
 const image=httpUrl(post.socialImage)??httpUrl(post.cover.url);
 return {...metadata,alternates:{canonical},openGraph:{...metadata.openGraph,type:'article',url:canonical,
   publishedTime:post.publishedAt??undefined,modifiedTime:post.updatedAt??undefined,...(image?{images:[{url:image}]}:{})},
   twitter:{...metadata.twitter,card:image?'summary_large_image' as const:'summary' as const,...(image?{images:[image]}:{})}};
}
export default async function Article({params}:Props){const {slug}=await params;const {post}=await getPublishedPost(slug);if(!post){const rule=await getBlogRedirect(slug);if(rule){if(rule.permanent)permanentRedirect(rule.to);redirect(rule.to);}notFound();}return <article className="article"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd({'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.summary,mainEntityOfPage:httpUrl(post.canonicalUrl)??absoluteUrl(`/blog/${encodeURIComponent(post.slug)}`),datePublished:post.publishedAt??undefined,dateModified:post.updatedAt??undefined,image:httpUrl(post.socialImage)??httpUrl(post.cover.url),publisher:{'@type':'Organization',name:'Codeflow Solutions',url:absoluteUrl('/')}})}}/><Link href="/blog" className="text-link"><ArrowLeft size={14}/>Back to the journal</Link><h1>{post.title}</h1>{post.publishedAt&&<time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}</time>}<p className="article-lead" style={{marginTop:22}}>{post.summary}</p>{post.cover.url&&<img className="article-cover" src={post.cover.url} alt={post.cover.alt??post.title}/>}<div className="article-body">{post.content?<RichText data={post.content as SerializedEditorState}/>:null}</div><aside className="panel"><h2>Try the photo face swap studio</h2><p>Prepare your source face and target photo, then open the editor. Check the studio for any development preview notice before submitting.</p><Link href="/face-swap" className="text-link">Open the face swap photo editor</Link></aside></article>;}
