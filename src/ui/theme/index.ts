import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { tokens } from './tokens';
import { softCardShadow, softControlShadow, highlightBorderOverlay } from './shadows';

export const radius = tokens.radius;

export const shadows = {
    xs: softControlShadow,
    sm: softControlShadow,
    md: softCardShadow,
    lg: softCardShadow,
    softCardShadow,
    softControlShadow,
    highlightBorderOverlay,
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
