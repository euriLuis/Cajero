import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

interface AppScreenProps {
    children: React.ReactNode;
    padding?: boolean;
    style?: ViewStyle;
}

export const AppScreen: React.FC<AppScreenProps> = ({ children, padding = true, style }) => {
    return (
        <SafeAreaView style={[styles.safeArea, style]}>
            <View style={[styles.container, padding && styles.withPadding]}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    withPadding: {
        paddingHorizontal: theme.spacing.base,
    },
});
