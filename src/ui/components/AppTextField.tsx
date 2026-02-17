import React from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    ViewStyle,
} from 'react-native';
import { theme } from '../theme';
import { radius } from '../theme';

interface AppTextFieldProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    helperText?: string;
}

export const AppTextField = React.forwardRef<TextInput, AppTextFieldProps>(
    ({ label, error, containerStyle, helperText, style, ...props }, ref) => {
        return (
            <View style={[styles.container, containerStyle]}>
                {label && <Text style={styles.label}>{label}</Text>}
                <TextInput
                    ref={ref}
                    style={[
                        styles.input,
                        error && styles.inputError,
                        style,
                    ]}
                    placeholderTextColor={theme.colors.mutedText}
                    {...props}
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
                {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
            </View>
        );
    }
);

AppTextField.displayName = 'AppTextField';

const styles = StyleSheet.create({
    container: {
        marginVertical: theme.spacing.sm,
    },
    label: {
        ...theme.typography.label,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
        fontWeight: '600',
    },
    input: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        borderRadius: radius.lg,
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.md,
        fontSize: theme.typography.body.fontSize,
        color: theme.colors.text,
        minHeight: 44,
    },
    inputError: {
        borderColor: theme.colors.danger,
        borderWidth: 1.5,
    },
    errorText: {
        ...theme.typography.caption,
        color: theme.colors.danger,
        marginTop: theme.spacing.xs,
    },
    helperText: {
        ...theme.typography.caption,
        color: theme.colors.mutedText,
        marginTop: theme.spacing.xs,
    },
});
