'use client';

import { useState, useEffect, useCallback } from 'react';
import { Semester, WeekdayGrid } from '@/types/enrollment';

interface UseEnrollmentsReturn {
    semesters: Semester[];
    selectedSemesterId: number | null;
    setSelectedSemesterId: (id: number) => void;
    grid: WeekdayGrid;
    loading: boolean;
    error: string | null;
    refreshGrid: () => Promise<void>;
    updateRoom: (enrollmentId: number, room: string) => Promise<void>;
}

export function useEnrollments(): UseEnrollmentsReturn {
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
    const [grid, setGrid] = useState<WeekdayGrid>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load semesters
    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                const response = await fetch('/api/semesters');
                if (!response.ok) throw new Error('Erro ao carregar semestres');
                const data: Semester[] = await response.json();
                setSemesters(data);
                if (data.length > 0 && !selectedSemesterId) {
                    setSelectedSemesterId(data[0].id);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Erro desconhecido';
                setError(message);
            }
        };
        fetchSemesters();
    }, [selectedSemesterId]);

    // Load grid data when semester changes
    const refreshGrid = useCallback(async () => {
        if (!selectedSemesterId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/enrollments?semesterId=${selectedSemesterId}`);
            if (!response.ok) throw new Error('Erro ao carregar enturmações');
            const data: WeekdayGrid = await response.json();
            setGrid(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [selectedSemesterId]);

    useEffect(() => {
        refreshGrid();
    }, [refreshGrid]);

    // Update room
    const updateRoom = useCallback(async (enrollmentId: number, room: string) => {
        const response = await fetch('/api/enrollments/rooms', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollmentId, room }),
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar sala');
        }
    }, []);

    return {
        semesters,
        selectedSemesterId,
        setSelectedSemesterId,
        grid,
        loading,
        error,
        refreshGrid,
        updateRoom,
    };
}
