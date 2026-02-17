import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme';

interface ThemeToggleButtonProps {
    style?: ViewStyle;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ style }) => {
    const { theme, mode, toggleTheme } = useTheme();

    // Icons: 🌙 for light mode, ☀️ for dark mode
    const icon = mode === 'light' ? '🌙' : '☀️';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                style,
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
        >
            <Text style={styles.icon}>{icon}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        marginRight: 8,
    },
    icon: {
        fontSize: 20,
    },
});
