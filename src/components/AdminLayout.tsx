'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>
            <Sidebar isOpen={sidebarOpen} />

            <div style={{
                flex: 1,
                marginLeft: '260px', // Matches sidebar width
                display: 'flex',
                flexDirection: 'column',
                transition: 'margin-left 0.3s ease'
            }}>
                <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

                <main style={{
                    flex: 1,
                    padding: '2rem',
                    overflowX: 'hidden'
                }}>
                    {children}
                </main>
            </div>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 45,
                        display: 'none' // Only show on mobile via media query in CSS if needed, or handle via JS
                    }}
                    onClick={() => setSidebarOpen(false)}
                    className="mobile-overlay"
                />
            )}

            <style jsx global>{`
        @media (max-width: 768px) {
          div[style*="marginLeft: 260px"] {
            margin-left: 0 !important;
          }
          .mobile-overlay {
            display: block !important;
          }
        }
      `}</style>
        </div>
    );
}
