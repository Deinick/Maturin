import { useState, useEffect } from 'react';

export type Theme        = 'light' | 'dark' | 'system';
export type WeekStart    = 'monday' | 'sunday';

interface Settings {
    theme:     Theme;
    weekStart: WeekStart;
}

const DEFAULTS: Settings = { theme: 'system', weekStart: 'monday' };
const KEY = 'steadily_settings';

function load(): Settings {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULTS;
}

function applyTheme(theme: Theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
}

export function useSettings() {
    const [settings, setSettings] = useState<Settings>(load);

    useEffect(() => {
        applyTheme(settings.theme);
        if (settings.theme !== 'system') return;
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyTheme(settings.theme);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [settings.theme]);

    function update<K extends keyof Settings>(key: K, value: Settings[K]) {
        setSettings(prev => {
            const next = { ...prev, [key]: value };
            localStorage.setItem(KEY, JSON.stringify(next));
            return next;
        });
    }

    return { settings, update };
}

// Read weekStart without the full hook — for pages that just need the value
export function getWeekStart(): WeekStart {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return (JSON.parse(raw) as Partial<Settings>).weekStart ?? DEFAULTS.weekStart;
    } catch { /* ignore */ }
    return DEFAULTS.weekStart;
}
