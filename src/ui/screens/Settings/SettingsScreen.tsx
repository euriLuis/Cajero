import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ScreenLayout } from '../../components/ScreenLayout';

export const SettingsScreen = () => {
    return (
        <ScreenLayout title="Settings">
            <Text style={styles.placeholder}>Settings Screen content goes here</Text>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    placeholder: {
        fontSize: 16,
        color: '#666',
    },
});
