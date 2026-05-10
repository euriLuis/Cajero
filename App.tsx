import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { AppNavigator } from './src/ui/navigation/AppNavigator';
import { runMigrations } from './src/data/db';
import { ErrorReportBoundary, ErrorReportProvider, SoftNoticeProvider, useErrorReporter } from './src/ui/components';
import { theme } from './src/ui/theme';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [isDbReady, setIsDbReady] = useState(false);
  const [errorMSG, setErrorMSG] = useState<string | null>(null);
  const { reportError } = useErrorReporter();

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        setIsDbReady(true);
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown database error';
        setErrorMSG(errorMessage);
        reportError({
          title: 'Error inicializando DB',
          message: errorMessage,
          source: 'Inicio / Base de datos',
          error: e,
          reproductionSteps: 'Abrir la app desde cero y esperar la pantalla de preparacion.',
        });
      }
    })();
  }, [reportError]);

  if (errorMSG) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={[styles.centeredScreen, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.errorTitle}>Error inicializando DB</Text>
          <Text style={styles.errorMessage}>{errorMSG}</Text>
        </View>
      </>
    );
  }

  if (!isDbReady) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={[styles.centeredScreen, { paddingTop: Math.max(insets.top, 16) }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            Preparando sistema...
          </Text>
        </View>
      </>
    );
  }

  return (
    <ErrorReportBoundary>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </ErrorReportBoundary>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SoftNoticeProvider>
        <ErrorReportProvider>
          <AppContent />
        </ErrorReportProvider>
      </SoftNoticeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  loadingText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
    color: theme.colors.text,
  },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
  },
});
