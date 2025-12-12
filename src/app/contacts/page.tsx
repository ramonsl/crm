'use client';

import { Suspense } from 'react';
import { ContactsPageContent } from '@/components/contacts/ContactsPageContent';

export default function ContactsPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
