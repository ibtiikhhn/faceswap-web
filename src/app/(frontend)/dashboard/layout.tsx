import { DashboardShell } from '@/components/dashboard';
export const metadata={title:'Your studio',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <DashboardShell>{children}</DashboardShell>;}
