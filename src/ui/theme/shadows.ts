import { StyleSheet } from 'react-native';

export const softCardShadow = StyleSheet.create({
  base: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
}).base;

export const softControlShadow = StyleSheet.create({
  base: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}).base;

export const highlightBorderOverlay = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
}).base;
