/**
 * useYCloudSettings Hook
 * 
 * React hook for managing YCloud provider settings.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface YCloudSettings {
    bulkSendProvider: 'whatsappjs' | 'ycloud';
    yCloudApiKey: string;
    yCloudWabaId: string;
    yCloudPhoneId: string;
}

interface UseYCloudSettingsReturn {
    settings: YCloudSettings;
    loading: boolean;
    saving: boolean;
    error: string | null;
    updateSettings: (newSettings: Partial<YCloudSettings>) => Promise<{ success: boolean; error?: string }>;
    testConnection: () => Promise<{ success: boolean; error?: string }>;
}

const defaultSettings: YCloudSettings = {
    bulkSendProvider: 'whatsappjs',
    yCloudApiKey: '',
    yCloudWabaId: '',
    yCloudPhoneId: ''
};

export function useYCloudSettings(): UseYCloudSettingsReturn {
    const [settings, setSettings] = useState<YCloudSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/settings');
            if (!res.ok) {
                throw new Error('Failed to fetch settings');
            }
            const data = await res.json();

            setSettings({
                bulkSendProvider: data.bulkSendProvider || 'whatsappjs',
                yCloudApiKey: data.yCloudApiKey || '',
                yCloudWabaId: data.yCloudWabaId || '',
                yCloudPhoneId: data.yCloudPhoneId || ''
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateSettings = async (newSettings: Partial<YCloudSettings>) => {
        try {
            setSaving(true);
            setError(null);

            // Map to API keys
            const payload: Record<string, string> = {};
            if (newSettings.bulkSendProvider !== undefined) {
                payload.bulk_send_provider = newSettings.bulkSendProvider;
            }
            if (newSettings.yCloudApiKey !== undefined) {
                payload.ycloud_api_key = newSettings.yCloudApiKey;
            }
            if (newSettings.yCloudWabaId !== undefined) {
                payload.ycloud_waba_id = newSettings.yCloudWabaId;
            }
            if (newSettings.yCloudPhoneId !== undefined) {
                payload.ycloud_phone_id = newSettings.yCloudPhoneId;
            }

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error('Failed to save settings');
            }

            // Update local state
            setSettings(prev => ({ ...prev, ...newSettings }));

            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        try {
            // Simple test: try to sync templates (will fail if credentials are wrong)  
            const res = await fetch('/api/ycloud-templates/sync', {
                method: 'POST'
            });

            if (!res.ok) {
                const data = await res.json();
                return { success: false, error: data.error || 'Connection test failed' };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    return {
        settings,
        loading,
        saving,
        error,
        updateSettings,
        testConnection
    };
}
