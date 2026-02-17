import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const radius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
};

export const shadows = {
    // iOS shadows
    xs: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 1.0,
        elevation: 1,
    },
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3.84,
        elevation: 3,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5.46,
        elevation: 5,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 9.65,
        elevation: 8,
    },
};

export const theme = {
    colors,
    typography,
    spacing,
    radius,
    shadows,
};

export type Theme = typeof theme;
export { colors, typography, spacing };
