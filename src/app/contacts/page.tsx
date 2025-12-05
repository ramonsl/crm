/**
 * Contacts Page - Unified interface for managing all contacts
 * Replaces the old duplicated leads/contacts pages
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import type { ContactView } from '@/types/contacts';

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as ContactView) || 'all';

  return <ContactsTable view={view} showTabs={true} />;
}
