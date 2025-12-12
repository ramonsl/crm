'use client';

import { useSearchParams } from 'next/navigation';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import type { ContactView } from '@/types/contacts';

export function ContactsPageContent() {
    const searchParams = useSearchParams();
    const view = (searchParams.get('view') as ContactView) || 'all';

    return <ContactsTable view={view} showTabs={true} />;
}
