/**
 * ContactsPagination - Reusable pagination component
 * 
 * Follows Single Responsibility Principle (SRP):
 * This component is responsible ONLY for pagination UI and user interactions.
 * It receives all data via props and communicates changes via callbacks.
 * 
 * Follows Interface Segregation Principle (ISP):
 * The props interface only includes what's necessary for pagination.
 */

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ContactsTable.module.css';

interface ContactsPaginationProps {
    /** Current page number (1-indexed) */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total count of items */
    totalCount: number;
    /** Current page size (items per page) */
    pageSize: number;
    /** Available page size options */
    pageSizeOptions?: number[];
    /** Callback when page changes */
    onPageChange: (page: number) => void;
    /** Callback when page size changes */
    onPageSizeChange: (size: number) => void;
}

/**
 * Generates the page numbers array for display
 * Includes ellipsis for large page counts
 */
function generatePageNumbers(currentPage: number, totalPages: number): (number | string)[] {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);

        if (currentPage > 3) {
            pages.push('...');
        }

        // Show pages around current
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 2) {
            pages.push('...');
        }

        // Always show last page
        if (totalPages > 1) {
            pages.push(totalPages);
        }
    }

    return pages;
}

/**
 * Calculates the range of items being displayed
 */
function calculateItemRange(currentPage: number, pageSize: number, totalCount: number): { start: number; end: number } {
    if (totalCount === 0) {
        return { start: 0, end: 0 };
    }
    const start = ((currentPage - 1) * pageSize) + 1;
    const end = Math.min(currentPage * pageSize, totalCount);
    return { start, end };
}

export function ContactsPagination({
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    pageSizeOptions = [25, 50, 100],
    onPageChange,
    onPageSizeChange,
}: ContactsPaginationProps) {
    const pages = generatePageNumbers(currentPage, totalPages);
    const { start, end } = calculateItemRange(currentPage, pageSize, totalCount);

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };

    const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onPageSizeChange(Number(event.target.value));
    };

    return (
        <div className={styles.pagination}>
            {/* Left: Page size selector */}
            <div className={styles.paginationLeft}>
                <label>Mostrar:</label>
                <select
                    className={styles.pageSizeSelect}
                    value={pageSize}
                    onChange={handlePageSizeChange}
                >
                    {pageSizeOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                <span>por página</span>
            </div>

            {/* Center: Page navigation */}
            <div className={styles.paginationCenter}>
                <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    title="Página anterior"
                >
                    <ChevronLeft size={18} />
                </button>

                <div className={styles.pageNumbers}>
                    {pages.map((page, index) => (
                        typeof page === 'number' ? (
                            <button
                                key={index}
                                className={`${styles.pageButton} ${currentPage === page ? styles.activePageButton : ''}`}
                                onClick={() => onPageChange(page)}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={index} className={styles.pageEllipsis}>
                                {page}
                            </span>
                        )
                    ))}
                </div>

                <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages || totalPages === 0}
                    title="Próxima página"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Right: Total count info */}
            <div className={styles.paginationRight}>
                {totalCount > 0 ? (
                    <span>
                        {start} - {end} de {totalCount} contatos
                    </span>
                ) : (
                    <span>0 contatos</span>
                )}
            </div>
        </div>
    );
}
