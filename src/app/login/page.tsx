'use client';

import { Suspense } from 'react';
import { LoginPageContent } from '@/components/auth/LoginPageContent';

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <LoginPageContent />
        </Suspense>
    );
}
