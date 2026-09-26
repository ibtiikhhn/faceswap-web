import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '@/server/cms';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const base=process.env.APP_URL??'http://localhost:3000';const {posts}=await getPublishedPosts();return [...['','/face-swap','/pricing','/blog'].map(path=>({url:`${base}${path}`})),...posts.map(post=>({url:`${base}/blog/${post.slug}`,lastModified:post.publishedAt?new Date(post.publishedAt):undefined}))];}
