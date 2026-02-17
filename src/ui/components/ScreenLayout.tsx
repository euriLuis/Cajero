import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';

interface ScreenLayoutProps {
    title: string;
    children?: ReactNode;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ title, children }) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
            </View>
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    {children}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingTop: theme.spacing.lg + 20,
        paddingBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.background, // Clean look, seamless with body
    },
    title: {
        ...theme.typography.title,
        color: theme.colors.text,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.md,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.spacing.sm,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        // Optional: add shadow if desired, but user asked for "border suave"
    },
});
