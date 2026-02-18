import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

type NoticeType = 'info' | 'success' | 'error';

interface NoticeOptions {
  title: string;
  message?: string;
  type?: NoticeType;
  durationMs?: number;
}

interface SoftNoticeContextValue {
  showNotice: (options: NoticeOptions) => void;
}

const SoftNoticeContext = createContext<SoftNoticeContextValue | null>(null);

export const SoftNoticeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notice, setNotice] = useState<NoticeOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideNotice = useCallback(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 18, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setNotice(null);
    });
  }, [opacity, translateY, visible]);

  const showNotice = useCallback((options: NoticeOptions) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    setNotice(options);
    setVisible(true);
    opacity.setValue(0);
    translateY.setValue(18);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();

    hideTimerRef.current = setTimeout(hideNotice, options.durationMs ?? 1800);
  }, [hideNotice, opacity, translateY]);

  const contextValue = useMemo(() => ({ showNotice }), [showNotice]);

  const indicatorStyle =
    notice?.type === 'success' ? styles.success : notice?.type === 'error' ? styles.error : styles.info;

  return (
    <SoftNoticeContext.Provider value={contextValue}>
      {children}
      {visible && notice ? (
        <View pointerEvents="box-none" style={styles.portal}>
          <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}> 
            <Pressable onPress={hideNotice} style={styles.toastPressable}>
              <View style={[styles.indicator, indicatorStyle]} />
              <View style={styles.content}>
                <Text style={styles.title}>{notice.title}</Text>
                {!!notice.message && <Text style={styles.message}>{notice.message}</Text>}
              </View>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </SoftNoticeContext.Provider>
  );
};

export const useSoftNotice = () => {
  const context = useContext(SoftNoticeContext);
  if (!context) {
    throw new Error('useSoftNotice must be used inside SoftNoticeProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  toast: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.softCardShadow,
  },
  toastPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  indicator: {
    width: 8,
    alignSelf: 'stretch',
    borderRadius: 8,
  },
  info: { backgroundColor: '#6B7A99' },
  success: { backgroundColor: '#2FA16F' },
  error: { backgroundColor: '#D14343' },
  content: { flex: 1 },
  title: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  message: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
    marginTop: 2,
  },
});
