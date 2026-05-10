import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

const SUPPORT_WHATSAPP_NUMBER = '5356624087';
const MAX_STACK_CHARS = 900;

type ErrorReportInput = {
  title?: string;
  message?: string;
  source?: string;
  error?: unknown;
  reproductionSteps?: string;
  details?: string;
};

type ErrorReport = Required<Pick<ErrorReportInput, 'title' | 'message' | 'source' | 'reproductionSteps'>> & {
  details?: string;
  technicalDetails?: string;
  createdAt: string;
};

type ErrorReportContextValue = {
  reportError: (input: ErrorReportInput | unknown, fallback?: Omit<ErrorReportInput, 'error'>) => void;
};

const ErrorReportContext = createContext<ErrorReportContextValue | null>(null);

const getErrorText = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message || 'Error desconocido',
      technicalDetails: [error.name, error.stack].filter(Boolean).join('\n').slice(0, MAX_STACK_CHARS),
    };
  }

  if (typeof error === 'string') {
    return { message: error, technicalDetails: error };
  }

  try {
    const serialized = JSON.stringify(error);
    return {
      message: serialized && serialized !== '{}' ? serialized : 'Error desconocido',
      technicalDetails: serialized,
    };
  } catch {
    return { message: 'Error desconocido', technicalDetails: String(error) };
  }
};

const normalizeReport = (input: ErrorReportInput | unknown, fallback?: Omit<ErrorReportInput, 'error'>): ErrorReport => {
  const isStructured = !!input && typeof input === 'object' && (
    'error' in input ||
    'title' in input ||
    'message' in input ||
    'source' in input ||
    'reproductionSteps' in input ||
    'details' in input
  );

  const reportInput = (isStructured ? input : { error: input }) as ErrorReportInput;
  const errorText = getErrorText(reportInput.error);

  return {
    title: reportInput.title || fallback?.title || 'Error detectado',
    message: reportInput.message || fallback?.message || errorText.message,
    source: reportInput.source || fallback?.source || 'No especificado',
    reproductionSteps: reportInput.reproductionSteps || fallback?.reproductionSteps || 'Describe que estabas haciendo justo antes del error.',
    details: reportInput.details || fallback?.details,
    technicalDetails: errorText.technicalDetails,
    createdAt: new Date().toLocaleString(),
  };
};

const buildWhatsAppMessage = (report: ErrorReport) => [
  'Reporte de error - Cajero',
  '',
  `Fecha: ${report.createdAt}`,
  `Origen: ${report.source}`,
  `Resumen: ${report.title}`,
  `Mensaje: ${report.message}`,
  '',
  'Como replicarlo:',
  report.reproductionSteps,
  '',
  report.details ? `Detalles: ${report.details}` : '',
  report.technicalDetails ? `Detalles tecnicos:\n${report.technicalDetails}` : '',
].filter(Boolean).join('\n');

class ErrorBoundaryInner extends React.Component<
  { children: React.ReactNode; onError: (error: unknown, componentStack?: string) => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    this.props.onError(error, info.componentStack || undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>La pantalla encontro un error.</Text>
          <Text style={styles.fallbackText}>Puedes enviar el reporte por WhatsApp y reiniciar la app.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export const ErrorReportBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { reportError } = useErrorReporter();

  const handleError = useCallback((error: unknown, componentStack?: string) => {
    reportError({
      title: 'Error de interfaz',
      message: 'Una pantalla dejo de responder correctamente.',
      source: 'Interfaz de usuario',
      error,
      reproductionSteps: 'Indica la pantalla abierta, el boton tocado y los datos que estabas usando.',
      details: componentStack,
    });
  }, [reportError]);

  return <ErrorBoundaryInner onError={handleError}>{children}</ErrorBoundaryInner>;
};

export const ErrorReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const reportError = useCallback<ErrorReportContextValue['reportError']>((input, fallback) => {
    setLinkError(null);
    setReport(normalizeReport(input, fallback));
  }, []);

  const closeReport = useCallback(() => {
    setReport(null);
    setLinkError(null);
  }, []);

  const sendReport = useCallback(async () => {
    if (!report) return;

    const text = encodeURIComponent(buildWhatsAppMessage(report));
    const url = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${text}`;

    try {
      await Linking.openURL(url);
      closeReport();
    } catch {
      setLinkError('No se pudo abrir WhatsApp. Verifica que este instalado o intenta copiar el reporte manualmente.');
    }
  }, [closeReport, report]);

  const value = useMemo(() => ({ reportError }), [reportError]);

  return (
    <ErrorReportContext.Provider value={value}>
      {children}
      <Modal visible={!!report} transparent animationType="fade" onRequestClose={closeReport}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>Enviar reporte de error</Text>
            <Text style={styles.body}>
              Se detecto un problema. Puedes mandar la informacion tecnica a WhatsApp para revisarlo junto con los pasos para replicarlo.
            </Text>

            {report && (
              <ScrollView style={styles.reportBox} contentContainerStyle={styles.reportBoxContent}>
                <Text style={styles.reportLabel}>Origen</Text>
                <Text style={styles.reportText}>{report.source}</Text>
                <Text style={styles.reportLabel}>Error</Text>
                <Text style={styles.reportText}>{report.message}</Text>
                <Text style={styles.reportLabel}>Como replicarlo</Text>
                <Text style={styles.reportText}>{report.reproductionSteps}</Text>
              </ScrollView>
            )}

            {!!linkError && <Text style={styles.linkError}>{linkError}</Text>}

            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.secondaryButton]} onPress={closeReport}>
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.primaryButton]} onPress={sendReport}>
                <Text style={styles.primaryButtonText}>Enviar a WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ErrorReportContext.Provider>
  );
};

export const useErrorReporter = () => {
  const context = useContext(ErrorReportContext);
  if (!context) {
    throw new Error('useErrorReporter must be used inside ErrorReportProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 18, 32, 0.42)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    maxHeight: '82%',
    ...theme.shadows.softCardShadow,
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
    fontWeight: '800',
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  reportBox: {
    maxHeight: 230,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  reportBoxContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  reportLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reportText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  linkError: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: theme.colors.success,
    borderColor: 'rgba(30,154,98,0.32)',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.border,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  fallbackTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
