import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export const SoftIconButton: React.FC<{ icon: string; onPress: () => void }> = ({ icon, onPress }) => (
  <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.icon}>{icon}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.softControlShadow,
  },
  icon: { color: theme.colors.text, fontSize: 16 },
});
