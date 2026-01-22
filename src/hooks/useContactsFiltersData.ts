'use client';

import { useState, useEffect } from 'react';

export function useContactsFiltersData() {
    const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [availableCourses, setAvailableCourses] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchFilters = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/filters');
                const data = await res.json();

                if (data.statuses) setAvailableStatuses(data.statuses);
                if (data.semesters) setAvailableSemesters(data.semesters);
                if (data.courses) setAvailableCourses(data.courses);
            } catch (error) {
                console.error('Error fetching filters:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFilters();
    }, []);

    return {
        availableStatuses,
        availableSemesters,
        availableCourses,
        loading
    };
}
