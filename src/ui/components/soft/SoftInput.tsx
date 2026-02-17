import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, Text } from 'react-native';
import { theme } from '../../theme';

interface SoftInputProps extends TextInputProps {
  icon?: string;
}

export const SoftInput: React.FC<SoftInputProps> = ({ icon, style, ...props }) => (
  <View style={styles.container}>
    {icon ? <Text style={styles.icon}>{icon}</Text> : null}
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={theme.colors.textMuted}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.softControlShadow,
  },
  icon: {
    marginRight: theme.spacing.sm,
    color: theme.colors.textMuted,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingVertical: theme.spacing.sm,
  },
});
