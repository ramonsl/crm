import { render, screen, waitFor } from '@testing-library/react';
import Sidebar from '@/components/Sidebar';
import { usePathname } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    usePathname: jest.fn(),
}));

describe('Sidebar', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        // Default pathname
        (usePathname as jest.Mock).mockReturnValue('/');

        // Mock fetch for WA status
        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({ status: 'ready' })
        });
    });

    it('should render navigation links', async () => {
        render(<Sidebar />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Inscritos')).toBeInTheDocument();
        expect(screen.getByText('Kanban')).toBeInTheDocument();
    });

    it('should highlight active link', async () => {
        (usePathname as jest.Mock).mockReturnValue('/contacts');
        render(<Sidebar />);

        // Use a more generic query if class logic is complex, OR inspect class
        const contactsLink = screen.getByText('Inscritos').closest('a');
        expect(contactsLink).toHaveClass('active'); // Assumes styles.active -> 'active' in class name mapping or checking CSS module
    });

    it('should fetch WhatsApp status', async () => {
        render(<Sidebar />);
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/whatsapp');
        });
    });
});
