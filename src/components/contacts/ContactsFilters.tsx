/**
 * ContactsFilters - Advanced filtering component
 */

'use client';

import { Search, Filter, X } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import type { ContactsFilters as FiltersType } from '@/types/contacts';
import styles from './ContactsFilters.module.css';

interface ContactsFiltersProps {
    filters: FiltersType;
    onFilterChange: <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => void;
    onReset: () => void;
    availableStatuses?: string[];
    availableSemesters?: string[];
    availableCourses?: string[];
}

export function ContactsFilters({
    filters,
    onFilterChange,
    onReset,
    availableStatuses = [],
    availableSemesters = [],
    availableCourses = []
}: ContactsFiltersProps) {
    const hasActiveFilters =
        filters.search ||
        (filters.status && filters.status.length > 0) ||
        (filters.semester && filters.semester.length > 0) ||
        (filters.course && filters.course.length > 0) ||
        filters.lastMessagePeriod ||
        filters.showOnlyNew ||
        filters.showOnlyStatusChanged;

    return (
        <div className={styles.filtersContainer}>
            {/* Search */}
            <div className={styles.searchBox}>
                <Search size={18} className={styles.searchIcon} />
                <input
                    type="text"
                    placeholder="Buscar por nome, CPF, telefone ou email..."
                    value={filters.search || ''}
                    onChange={(e) => onFilterChange('search', e.target.value)}
                    className={styles.searchInput}
                />
                {filters.search && (
                    <button
                        onClick={() => onFilterChange('search', '')}
                        className={styles.clearButton}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Filters Row */}
            <div className={styles.filtersRow}>
                {/* Status Filter */}
                {availableStatuses.length > 0 && (
                    <div className={styles.filterGroup}>
                        <label>Status</label>
                        <MultiSelect
                            options={availableStatuses}
                            selected={filters.status || []}
                            onChange={(values) => onFilterChange('status', values)}
                            placeholder="Todos os status"
                        />
                    </div>
                )}

                {/* Semester Filter */}
                {availableSemesters.length > 0 && (
                    <div className={styles.filterGroup}>
                        <label>Semestre</label>
                        <MultiSelect
                            options={availableSemesters}
                            selected={filters.semester || []}
                            onChange={(values) => onFilterChange('semester', values)}
                            placeholder="Todos os semestres"
                        />
                    </div>
                )}

                {/* Course Filter */}
                {availableCourses.length > 0 && (
                    <div className={styles.filterGroup}>
                        <label>Curso</label>
                        <MultiSelect
                            options={availableCourses}
                            selected={filters.course || []}
                            onChange={(values) => onFilterChange('course', values)}
                            placeholder="Todos os cursos"
                        />
                    </div>
                )}

                {/* Last Message Period */}
                <div className={styles.filterGroup}>
                    <label>Última Mensagem</label>
                    <select
                        value={filters.lastMessagePeriod || ''}
                        onChange={(e) => onFilterChange('lastMessagePeriod', e.target.value)}
                        className={styles.select}
                    >
                        <option value="">Todos</option>
                        <option value="1h">Última hora</option>
                        <option value="today">Hoje</option>
                        <option value="1-3d">1-3 dias</option>
                        <option value="3-7d">3-7 dias</option>
                        <option value="7-15d">7-15 dias</option>
                        <option value="15d+">+15 dias</option>
                        <option value="never">Nunca</option>
                    </select>
                </div>

                {/* Checkboxes */}
                <div className={styles.checkboxGroup}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={filters.showOnlyNew || false}
                            onChange={(e) => onFilterChange('showOnlyNew', e.target.checked)}
                        />
                        <span>Apenas Novos</span>
                    </label>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={filters.showOnlyStatusChanged || false}
                            onChange={(e) => onFilterChange('showOnlyStatusChanged', e.target.checked)}
                        />
                        <span>Status Alterado</span>
                    </label>
                </div>

                {/* Reset Button */}
                {hasActiveFilters && (
                    <button onClick={onReset} className={styles.resetButton}>
                        <X size={16} />
                        Limpar Filtros
                    </button>
                )}
            </div>
        </div>
    );
}
