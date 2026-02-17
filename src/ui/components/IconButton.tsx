import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Text } from 'react-native';
import { theme } from '../theme';
import { radius } from '../theme';

interface IconButtonProps {
    name: string;
    onPress: () => void;
    size?: number;
    color?: string;
    style?: ViewStyle;
    disabled?: boolean;
    background?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
    name,
    onPress,
    size = 24,
    color = theme.colors.text,
    style,
    disabled = false,
    background = false,
}) => {
    return (
        <TouchableOpacity
            style={[
                styles.button,
                background && styles.withBackground,
                disabled && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <Text style={{ fontSize: size, color }}>{name}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        padding: theme.spacing.sm,
        borderRadius: radius.full,
    },
    withBackground: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    disabled: {
        opacity: 0.5,
    },
});
