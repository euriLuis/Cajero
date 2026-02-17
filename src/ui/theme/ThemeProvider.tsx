import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { darkTheme, lightTheme, Theme } from './themes';
import { getDb } from '../../data/db/sqlite';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    theme: Theme;
    toggleTheme: () => void;
    isLoading: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>('dark');
    const [isLoading, setIsLoading] = useState(true);

    // Load theme mode from database on mount
    useEffect(() => {
        loadThemeMode();
    }, []);

    const loadThemeMode = async () => {
        try {
            const db = await getDb();
            const result = await db.getAllAsync<{ value: string }>(
                'SELECT value FROM app_settings WHERE key = ?',
                ['theme_mode']
            );

            if (result.length > 0) {
                const savedMode = result[0].value as ThemeMode;
                setMode(savedMode === 'light' ? 'light' : 'dark');
            } else {
                // Default to dark
                setMode('dark');
            }
        } catch (error) {
            setMode('dark');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTheme = async () => {
        const newMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
        setMode(newMode);

        // Save to database
        try {
            const db = await getDb();
            await db.runAsync(
                'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
                ['theme_mode', newMode]
            );
        } catch (error) {
            // Error silenciado en producción
        }
    };

    const theme = mode === 'light' ? lightTheme : darkTheme;

    return (
        <ThemeContext.Provider value={{ mode, theme, toggleTheme, isLoading }}>
            {children}
        </ThemeContext.Provider>
    );
};
