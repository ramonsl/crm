'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import type { ContactView } from '@/types/contacts';

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as ContactView) || 'all';

  return <ContactsTable view={view} showTabs={true} />;
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
