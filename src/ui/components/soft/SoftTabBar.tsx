import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

const iconByRoute: Record<string, string> = {
  Venta: 'cart-outline',
  Contador: 'calculator-variant-outline',
  Resumen: 'chart-line',
  Productos: 'cube-outline',
  Historial: 'receipt-text-clock-outline',
};

export const SoftTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  const tabCount = state.routes.length;
  const trackPadding = 6;
  const tabWidth = useMemo(() => {
    if (!containerWidth || tabCount === 0) return 0;
    return (containerWidth - trackPadding * 2) / tabCount;
  }, [containerWidth, tabCount]);

  const slideX = useRef(new Animated.Value(0)).current;
  const activeIndexAnim = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    if (!tabWidth) return;

    Animated.parallel([
      Animated.timing(slideX, {
        toValue: state.index * tabWidth,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(activeIndexAnim, {
        toValue: state.index,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndexAnim, slideX, state.index, tabWidth]);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View
        style={styles.container}
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      >
        {!!tabWidth && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              {
                width: tabWidth,
                transform: [{ translateX: slideX }],
              },
            ]}
          />
        )}

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          const label = descriptors[route.key].options.title ?? route.name;
          const iconName = iconByRoute[route.name] ?? 'circle-outline';

          const shiftX = activeIndexAnim.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [4, 0, -4],
            extrapolate: 'clamp',
          });

          const selectedProgress = activeIndexAnim.interpolate({
            inputRange: [index - 0.6, index, index + 0.6],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });

          const scale = selectedProgress.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1.09] });
          const rise = selectedProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              activeOpacity={0.9}
            >
              <Animated.View style={{ transform: [{ translateX: shiftX }, { translateY: rise }, { scale }] }}>
                <View style={styles.tabInner}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={isFocused ? 27 : 21}
                    color={isFocused ? theme.colors.text : theme.colors.textMuted}
                  />
                  <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>{label}</Text>
                </View>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 6,
    overflow: 'hidden',
    ...theme.shadows.softCardShadow,
  },
  activePill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    ...theme.shadows.softControlShadow,
  },
  tab: {
    flex: 1,
    borderRadius: theme.radius.control,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabInner: {
    minHeight: 50,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  labelActive: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
