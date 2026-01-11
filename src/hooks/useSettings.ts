import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import type { SettingsData } from '@/types/settings';

export function useSettings() {
    const { success, error, warning } = useToast();
    const [settings, setSettings] = useState<SettingsData>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            setSettings({
                openaiApiKey: data.openaiApiKey || '',
                minDelay: Number(data.minDelay) || 30,
                maxDelay: Number(data.maxDelay) || 60,
                metaMatriculas: Number(data.metaMatriculas) || 0,
                comercialPhone: data.comercialPhone || '',
                comercialName: data.comercialName || ''
            });
        } catch (err) {
            error('Erro ao carregar configurações');
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key: keyof SettingsData, value: string | number) => {
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });

            if (res.ok) {
                setSettings(prev => ({ ...prev, [key]: value }));
                success('Configuração salva com sucesso!');
                return true;
            } else {
                const data = await res.json();
                error(data.error || 'Erro ao salvar configuração');
                return false;
            }
        } catch (err) {
            error('Erro ao salvar configuração');
            console.error('Error updating setting:', err);
            return false;
        }
    };

    return {
        settings,
        loading,
        updateSetting,
        toast: { success, error, warning }
    };
}
