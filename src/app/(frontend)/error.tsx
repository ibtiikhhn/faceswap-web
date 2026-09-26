'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <div className="wrap" style={{padding:'65px 0'}}><div className="empty-state"><h2>We hit a little pause.</h2><p>This page couldn’t load. Please try again in a moment.</p><button className="button button-outline" onClick={reset}>Try again</button></div></div>;}
