import React from 'react';
import { View, ViewStyle, StyleSheet, ViewProps, StyleProp } from 'react-native';
import { theme } from '../theme';
import { shadows, radius } from '../theme';

interface CardProps extends ViewProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: boolean;
    style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    padding = true,
    style,
    ...props
}) => {
    return (
        <View
            style={[
                styles.card,
                variant === 'elevated' && styles.elevated,
                variant === 'outlined' && styles.outlined,
                padding && styles.withPadding,
                style,
            ]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.card,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    elevated: {
        ...shadows.md,
    },
    outlined: {
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    withPadding: {
        padding: theme.spacing.base,
    },
});
