import Link from 'next/link';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { RichText } from '@payloadcms/richtext-lexical/react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { getPublishedPost, getBlogRedirect } from '@/server/cms';
import { ArrowLeft } from '@/components/icons';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props){const {slug}=await params;const {post}=await getPublishedPost(slug);return {title:post?.seoTitle??post?.title??'Article not found',description:post?.seoDescription??post?.summary};}
export default async function Article({params}:Props){const {slug}=await params;const {post}=await getPublishedPost(slug);if(!post){const rule=await getBlogRedirect(slug);if(rule){if(rule.permanent)permanentRedirect(rule.to);redirect(rule.to);}notFound();}return <article className="article"><Link href="/blog" className="text-link"><ArrowLeft size={14}/>Back to the journal</Link><h1>{post.title}</h1>{post.publishedAt&&<time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}</time>}<p className="article-lead" style={{marginTop:22}}>{post.summary}</p>{post.cover.url&&<img className="article-cover" src={post.cover.url} alt={post.cover.alt??post.title}/>}<div className="article-body">{post.content?<RichText data={post.content as SerializedEditorState}/>:null}</div></article>;}
