import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { Text, ActivityIndicator, View } from 'react-native';
import { AppNavigator } from './src/ui/navigation/AppNavigator';
import { runMigrations } from './src/data/db';
import { ScreenLayout } from './src/ui/components/ScreenLayout';
import { SoftNoticeProvider } from './src/ui/components';
import { theme } from './src/ui/theme';

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [errorMSG, setErrorMSG] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        setIsDbReady(true);
      } catch (e: any) {
        setErrorMSG(e instanceof Error ? e.message : 'Unknown database error');
      }
    })();
  }, []);

  if (errorMSG) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ScreenLayout title="Error">
          <Text style={{ color: 'red', fontSize: 18, marginBottom: 10 }}>Error inicializando DB</Text>
          <Text>{errorMSG}</Text>
        </ScreenLayout>
      </SafeAreaProvider>
    );
  }

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 20, textAlign: 'center', fontSize: 16, color: theme.colors.text }}>
            Preparando sistema...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SoftNoticeProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </SoftNoticeProvider>
    </SafeAreaProvider>
  );
}
