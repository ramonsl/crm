/**
 * Leads Page - Redirects to contacts with leads view
 * This maintains the /leads URL for backwards compatibility
 */

import { redirect } from 'next/navigation';

export default function LeadsPage() {
    redirect('/contacts?view=leads');
}
