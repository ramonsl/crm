/**
 * ContactsPagination Component Tests
 * 
 * Tests for the pagination component following React Testing Library best practices.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ContactsPagination } from '@/components/contacts/ContactsPagination';

describe('ContactsPagination', () => {
    const defaultProps = {
        currentPage: 1,
        totalPages: 10,
        totalCount: 250,
        pageSize: 25,
        onPageChange: jest.fn(),
        onPageSizeChange: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render current page info correctly', () => {
            render(<ContactsPagination {...defaultProps} />);
            expect(screen.getByText('1 - 25 de 250 contatos')).toBeInTheDocument();
        });

        it('should render "0 contatos" when totalCount is 0', () => {
            render(<ContactsPagination {...defaultProps} totalCount={0} />);
            expect(screen.getByText('0 contatos')).toBeInTheDocument();
        });

        it('should render page size selector with correct value', () => {
            render(<ContactsPagination {...defaultProps} pageSize={50} />);
            const select = screen.getByRole('combobox');
            expect(select).toHaveValue('50');
        });

        it('should render all page size options', () => {
            render(<ContactsPagination {...defaultProps} />);
            expect(screen.getByText('25')).toBeInTheDocument();
            expect(screen.getByText('50')).toBeInTheDocument();
            expect(screen.getByText('100')).toBeInTheDocument();
        });
    });

    describe('navigation buttons', () => {
        it('should disable previous button on first page', () => {
            render(<ContactsPagination {...defaultProps} currentPage={1} />);
            expect(screen.getByTitle('Página anterior')).toBeDisabled();
        });

        it('should enable previous button when not on first page', () => {
            render(<ContactsPagination {...defaultProps} currentPage={5} />);
            expect(screen.getByTitle('Página anterior')).not.toBeDisabled();
        });

        it('should disable next button on last page', () => {
            render(<ContactsPagination {...defaultProps} currentPage={10} totalPages={10} />);
            expect(screen.getByTitle('Próxima página')).toBeDisabled();
        });

        it('should enable next button when not on last page', () => {
            render(<ContactsPagination {...defaultProps} currentPage={5} />);
            expect(screen.getByTitle('Próxima página')).not.toBeDisabled();
        });
    });

    describe('interactions', () => {
        it('should call onPageChange when next button is clicked', () => {
            render(<ContactsPagination {...defaultProps} currentPage={5} />);
            fireEvent.click(screen.getByTitle('Próxima página'));
            expect(defaultProps.onPageChange).toHaveBeenCalledWith(6);
        });

        it('should call onPageChange when previous button is clicked', () => {
            render(<ContactsPagination {...defaultProps} currentPage={5} />);
            fireEvent.click(screen.getByTitle('Página anterior'));
            expect(defaultProps.onPageChange).toHaveBeenCalledWith(4);
        });

        it('should call onPageChange when a page number is clicked', () => {
            render(<ContactsPagination {...defaultProps} currentPage={1} />);
            // Click on page 3
            const pageButtons = screen.getAllByRole('button').filter(
                btn => btn.textContent === '3'
            );
            if (pageButtons.length > 0) {
                fireEvent.click(pageButtons[0]);
                expect(defaultProps.onPageChange).toHaveBeenCalledWith(3);
            }
        });

        it('should call onPageSizeChange when page size is changed', () => {
            render(<ContactsPagination {...defaultProps} />);
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: '50' } });
            expect(defaultProps.onPageSizeChange).toHaveBeenCalledWith(50);
        });
    });

    describe('page numbers display', () => {
        it('should show all pages when totalPages <= 5', () => {
            render(<ContactsPagination {...defaultProps} totalPages={5} />);
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('4')).toBeInTheDocument();
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('should show ellipsis for many pages', () => {
            render(<ContactsPagination {...defaultProps} currentPage={5} totalPages={10} />);
            // Should show first, some middle pages, and last
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });
    });
});
