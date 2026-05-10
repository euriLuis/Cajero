import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { FLOATING_TAB_BAR_HEIGHT, getBottomSystemGap } from '../../navigation/safeAreaMetrics';

const iconByRoute: Record<string, string> = {
  Venta: 'cart-outline',
  Contador: 'calculator-variant-outline',
  Resumen: 'chart-line',
  Productos: 'cube-outline',
  Historial: 'receipt-text-clock-outline',
};

export const SoftTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const isCompact = width < 380;
  const horizontalPadding = isCompact ? 8 : 14;
  const bottomGap = getBottomSystemGap(insets.bottom);

  const tabCount = state.routes.length;
  const trackPadding = 5;
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
    <View
      style={[
        styles.wrapper,
        {
          paddingLeft: Math.max(insets.left, horizontalPadding),
          paddingRight: Math.max(insets.right, horizontalPadding),
          paddingBottom: bottomGap,
        },
      ]}
      pointerEvents="box-none"
    >
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
                    size={isFocused ? (isCompact ? 25 : 27) : (isCompact ? 20 : 21)}
                    color={isFocused ? theme.colors.text : theme.colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.label,
                      isCompact && styles.labelCompact,
                      isFocused && styles.labelActive,
                      isFocused && isCompact && styles.labelActiveCompact,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                  >
                    {label}
                  </Text>
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
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    minHeight: FLOATING_TAB_BAR_HEIGHT,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 5,
    overflow: 'hidden',
    ...theme.shadows.softCardShadow,
  },
  activePill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: 14,
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
    minWidth: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  labelCompact: {
    fontSize: 10,
  },
  labelActive: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  labelActiveCompact: {
    fontSize: 12,
  },
});
