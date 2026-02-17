import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { radius } from '../theme';

interface AppButtonProps {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    labelStyle?: TextStyle;
    fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    style,
    labelStyle,
    fullWidth = false,
}) => {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            style={[
                styles.button,
                styles[`button_${size}`],
                styles[`button_${variant}`],
                isDisabled && styles.buttonDisabled,
                fullWidth && styles.fullWidth,
                style,
            ]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.75}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'ghost' ? theme.colors.primary : '#FFFFFF'}
                    size="small"
                />
            ) : (
                <Text
                    style={[
                        styles.label,
                        styles[`label_${variant}`],
                        styles[`label_${size}`],
                        isDisabled && styles.labelDisabled,
                        labelStyle,
                    ]}
                >
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    fullWidth: {
        width: '100%',
    },
    // Sizes
    button_sm: {
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
        minHeight: 36,
    },
    button_md: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        minHeight: 44,
    },
    button_lg: {
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.base,
        minHeight: 52,
    },
    // Variants
    button_primary: {
        backgroundColor: theme.colors.primary,
        shadowColor: '#10B981',
    },
    button_secondary: {
        backgroundColor: theme.colors.background,
        borderWidth: 1.5,
        borderColor: theme.colors.primary,
        shadowColor: '#10B981',
        shadowOpacity: 0.08,
    },
    button_danger: {
        backgroundColor: theme.colors.danger,
        shadowColor: '#EF4444',
    },
    button_ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
    },
    // Disabled
    buttonDisabled: {
        opacity: 0.5,
    },
    // Labels
    label: {
        fontWeight: '600',
    },
    label_sm: {
        fontSize: 13,
    },
    label_md: {
        fontSize: 16,
    },
    label_lg: {
        fontSize: 18,
    },
    label_primary: {
        color: '#FFFFFF',
    },
    label_secondary: {
        color: theme.colors.text,
    },
    label_danger: {
        color: '#FFFFFF',
    },
    label_ghost: {
        color: theme.colors.primary,
    },
    labelDisabled: {
        opacity: 0.6,
    },
});
