import { tokens } from './tokens';

export const typography = {
    h1: { fontSize: 26, fontWeight: '600' as const, lineHeight: 32, letterSpacing: -0.3 },
    h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28, letterSpacing: -0.2 },
    title: { ...tokens.typography.title, letterSpacing: -0.2 },
    subtitle: { ...tokens.typography.section, letterSpacing: 0 },
    body: { ...tokens.typography.body, letterSpacing: 0 },
    bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 19, letterSpacing: 0 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 18, letterSpacing: 0 },
    caption: { ...tokens.typography.caption, letterSpacing: 0.2 },
    captionSmall: { fontSize: 12, fontWeight: '500' as const, lineHeight: 15, letterSpacing: 0.2 },
    label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 17, letterSpacing: 0 },
};
