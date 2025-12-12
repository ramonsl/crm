'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from './AdminLayout';

export default function ConditionalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Don't show AdminLayout on login page
    if (pathname === '/login') {
        return <>{children}</>;
    }

    return <AdminLayout>{children}</AdminLayout>;
}
