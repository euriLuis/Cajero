import { colors as darkColors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

// Light theme - inverted colors from dark
export const lightTheme = {
    colors: {
        // Background
        background: '#FFFFFF',
        surface: '#F5F5F5',
        card: '#EEEEEE',

        // Text
        text: '#1A1A1A',
        textSecondary: '#424242',
        mutedText: '#757575',

        // Accents
        primary: '#10B981',
        primaryLight: '#34D399',
        primaryDark: '#059669',

        // Status
        danger: '#EF4444',
        dangerLight: '#F87171',
        success: '#10B981',
        warning: '#F59E0B',
        info: '#3B82F6',

        // Borders & Dividers
        border: '#CCCCCC',
        borderLight: '#EEEEEE',

        // Special
        disabled: '#BDBDBD',
        overlay: 'rgba(0, 0, 0, 0.3)',
    },
    typography,
    spacing,
};

// Dark theme - same as before
export const darkTheme = {
    colors: darkColors,
    typography,
    spacing,
};

export type Theme = typeof darkTheme;
