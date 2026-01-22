'use client';

import { useState, useEffect } from 'react';
import type { Contact } from '@/types/contacts';
import type { Tag } from '@/types/tag';

export function useContactsTags(contacts: Contact[]) {
    const [leadTags, setLeadTags] = useState<Map<string, Tag[]>>(new Map());

    useEffect(() => {
        const loadTagsForContacts = async () => {
            if (contacts.length === 0) return;

            const tagsMap = new Map<string, Tag[]>();

            await Promise.all(
                contacts.map(async (contact) => {
                    try {
                        const response = await fetch(`/api/leads/${contact.cpf}/tags`);
                        if (response.ok) {
                            const data = await response.json();
                            tagsMap.set(contact.cpf, data.data || []);
                        }
                    } catch (error) {
                        console.error(`Error loading tags for ${contact.cpf}:`, error);
                    }
                })
            );

            setLeadTags(tagsMap);
        };

        loadTagsForContacts();
    }, [contacts]);

    const updateLeadTags = (cpf: string, newTags: Tag[]) => {
        setLeadTags(prev => {
            const next = new Map(prev);
            next.set(cpf, newTags);
            return next;
        });
    };

    return {
        leadTags,
        updateLeadTags
    };
}
