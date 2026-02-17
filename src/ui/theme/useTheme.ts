import { useContext } from 'react';
import { ThemeContext, ThemeMode } from './ThemeProvider';
import { Theme } from './themes';

interface UseThemeReturn {
    theme: Theme;
    mode: ThemeMode;
    toggleTheme: () => void;
    isLoading: boolean;
}

export const useTheme = (): UseThemeReturn => {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }

    return context;
};
