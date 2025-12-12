'use client';

import { Suspense } from 'react';
import { ImportPageContent } from '@/components/import/ImportPageContent';

export default function ImportPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <ImportPageContent />
        </Suspense>
    );
}
