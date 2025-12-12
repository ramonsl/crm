'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile screen
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth <= 768) {
                setSidebarCollapsed(true); // Start collapsed on mobile
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>
            <Sidebar isOpen={!sidebarCollapsed} onToggle={toggleSidebar} />

            <div style={{
                flex: 1,
                marginLeft: sidebarCollapsed ? '0' : (isMobile ? '0' : '260px'),
                display: 'flex',
                flexDirection: 'column',
                transition: 'margin-left 0.3s ease'
            }}>
                <Header toggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />

                <main style={{
                    flex: 1,
                    padding: '2rem',
                    overflowX: 'auto'
                }}>
                    {children}
                </main>
            </div>

            {/* Mobile Overlay - shows when sidebar is open on mobile */}
            {!sidebarCollapsed && isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 45
                    }}
                    onClick={() => setSidebarCollapsed(true)}
                />
            )}
        </div>
    );
}
