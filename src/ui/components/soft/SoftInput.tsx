import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, Text, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../theme';

interface SoftInputProps extends TextInputProps {
  leftIcon?: string;
  rightIcon?: string;
  size?: 'normal' | 'compact';
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  iconStyle?: StyleProp<TextStyle>;
}

export const SoftInput = React.forwardRef<TextInput, SoftInputProps>(({
  leftIcon,
  rightIcon,
  size = 'normal',
  containerStyle,
  inputStyle,
  iconStyle,
  ...props
}, ref) => (
  <View style={[styles.container, size === 'compact' && styles.compactContainer, containerStyle]}>
    {!!leftIcon && <Text style={[styles.icon, size === 'compact' && styles.compactIcon, iconStyle]}>{leftIcon}</Text>}
    <TextInput
      ref={ref}
      style={[styles.input, size === 'compact' && styles.compactInput, inputStyle]}
      placeholderTextColor={theme.colors.textMuted}
      {...props}
    />
    {!!rightIcon && <Text style={[styles.icon, size === 'compact' && styles.compactIcon, iconStyle]}>{rightIcon}</Text>}
  </View>
));

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.softControlShadow,
  },
  compactContainer: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: theme.spacing.sm,
  },
  icon: {
    marginHorizontal: 4,
    marginRight: 8,
    color: theme.colors.textMuted,
    fontSize: 18,
    lineHeight: 18,
    textAlignVertical: 'center',
  },
  compactIcon: {
    fontSize: 16,
    lineHeight: 16,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingVertical: theme.spacing.sm,
  },
  compactInput: {
    fontSize: 14,
    paddingVertical: 6,
  },
});
