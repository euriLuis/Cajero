import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { ThemeToggleButton } from './ThemeToggleButton';

interface AppHeaderProps {
    title: string;
    subtitle?: string;
    style?: ViewStyle;
    showThemeToggle?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    title,
    subtitle,
    style,
    showThemeToggle = true,
}) => {
    const { theme } = useTheme();

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: theme.colors.background },
                style,
            ]}
        >
            <View style={styles.titleSection}>
                <Text
                    style={[
                        theme.typography.h2,
                        { color: theme.colors.text },
                    ]}
                >
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        style={[
                            theme.typography.caption,
                            { color: theme.colors.mutedText, marginTop: 4 },
                        ]}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
            {showThemeToggle && <ThemeToggleButton />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    titleSection: {
        flex: 1,
    },
});
