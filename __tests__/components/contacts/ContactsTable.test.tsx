import { render, screen, fireEvent } from '@testing-library/react';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import * as useContactsHook from '@/hooks/useContacts';
import * as useContactsFiltersHook from '@/hooks/useContactsFilters';
import * as useContactsSelectionHook from '@/hooks/useContactsSelection';
import * as useWhatsAppStatusHook from '@/hooks/useWhatsAppStatus';
import * as toastContext from '@/contexts/ToastContext';

// Mock child components to simplify testing
jest.mock('@/components/contacts/ContactsTableRow', () => ({
    ContactsTableRow: ({ contact }: { contact: { nome: string } }) => (
        <tr data-testid="contact-row">
            <td>{contact.nome}</td>
        </tr>
    )
}));

jest.mock('@/components/contacts/ContactsPagination', () => ({
    ContactsPagination: ({ onPageChange }: { onPageChange: (page: number) => void }) => (
        <button data-testid="next-page" onClick={() => onPageChange(2)}>Next</button>
    )
}));

// Mock hooks
const mockUseContacts = {
    contacts: [],
    loading: false,
    error: null,
    totalPages: 1,
    totalCount: 0,
    currentPage: 1,
    refresh: jest.fn(),
};

const mockUseContactsFilters = {
    filters: { page: 1, limit: 10 },
    updateFilter: jest.fn(),
    updateFilters: jest.fn(),
    resetFilters: jest.fn(),
    setFilters: jest.fn(),
};

const mockUseContactsSelection = {
    selected: [],
    toggleSelect: jest.fn(),
    toggleSelectAll: jest.fn(),
    clearSelection: jest.fn(),
    isSelected: jest.fn().mockReturnValue(false),
    isAllSelected: jest.fn().mockReturnValue(false),
    selectedCount: 0,
};

const mockUseWhatsAppStatus = {
    status: 'ready' as const,
    isReady: true,
    loading: false,
    isDisconnected: false,
    isInitializing: false,
};

const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    showToast: jest.fn(),
};

describe('ContactsTable', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        // Setup default mocks
        jest.spyOn(useContactsHook, 'useContacts').mockReturnValue(mockUseContacts);
        jest.spyOn(useContactsFiltersHook, 'useContactsFilters').mockReturnValue(mockUseContactsFilters);
        jest.spyOn(useContactsSelectionHook, 'useContactsSelection').mockReturnValue(mockUseContactsSelection);
        jest.spyOn(useWhatsAppStatusHook, 'useWhatsAppStatus').mockReturnValue(mockUseWhatsAppStatus);
        jest.spyOn(toastContext, 'useToast').mockReturnValue(mockToast);

        // Mock fetch for filters/settings
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({})
        });
    });

    it('should render loading state', () => {
        jest.spyOn(useContactsHook, 'useContacts').mockReturnValue({ ...mockUseContacts, loading: true });
        render(<ContactsTable />);
        expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('should render empty state', () => {
        jest.spyOn(useContactsHook, 'useContacts').mockReturnValue({ ...mockUseContacts, contacts: [] });
        render(<ContactsTable />);
        expect(screen.getByText('Nenhum contato encontrado')).toBeInTheDocument();
    });

    it('should render list of contacts', () => {
        const contacts = [
            { cpf: '1', nome: 'John Doe', telefone: '123', status: 'lead' },
            { cpf: '2', nome: 'Jane Doe', telefone: '456', status: 'lead' }
        ];
        jest.spyOn(useContactsHook, 'useContacts').mockReturnValue({
            ...mockUseContacts,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            contacts: contacts as unknown as { cpf: string; nome: string; telefone: string; status: string }[] as any[],
            totalCount: 2
        });

        render(<ContactsTable />);

        const rows = screen.getAllByTestId('contact-row');
        expect(rows).toHaveLength(2);
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle page change', () => {
        render(<ContactsTable />);
        const nextBtn = screen.getByTestId('next-page');
        fireEvent.click(nextBtn);

        expect(mockUseContactsFilters.updateFilter).toHaveBeenCalledWith('page', 2);
    });
});
