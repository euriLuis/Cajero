import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';

type Variant = 'primary' | 'ghost' | 'danger';

export const SoftButton: React.FC<{
  label: string;
  onPress: () => void;
  variant?: Variant;
  style?: ViewStyle;
  disabled?: boolean;
}> = ({ label, onPress, variant = 'primary', style, disabled }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.9}
    >
      <Text style={[styles.label, variant === 'danger' && styles.dangerText]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.control,
    minHeight: 42,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.softControlShadow,
  },
  primary: { backgroundColor: theme.colors.surface },
  ghost: { backgroundColor: theme.colors.surface2 },
  danger: { backgroundColor: '#FFE7E4', borderColor: 'rgba(255,59,48,0.25)' },
  label: { color: theme.colors.text, fontWeight: '600' },
  dangerText: { color: theme.colors.danger },
  pressed: { transform: [{ scale: 0.985 }], shadowOpacity: 0.03, elevation: 1 },
  disabled: { opacity: 0.55 },
});
