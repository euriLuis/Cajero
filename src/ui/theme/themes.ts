import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const lightTheme = {
    colors,
    typography,
    spacing,
};

// Only light mode is supported visually; dark maps to same palette for compatibility.
export const darkTheme = {
    colors,
    typography,
    spacing,
};

export type Theme = typeof lightTheme;
