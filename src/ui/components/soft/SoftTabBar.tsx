import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme';

const iconByRoute: Record<string, string> = {
  Venta: 'cart-outline',
  Contador: 'calculator-variant-outline',
  Resumen: 'chart-line',
  Productos: 'cube-outline',
  Historial: 'receipt-text-clock-outline',
};

export const SoftTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const label = descriptors[route.key].options.title ?? route.name;
          const iconName = iconByRoute[route.name] ?? 'circle-outline';

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={[styles.tab, isFocused && styles.tabActive]} activeOpacity={0.9}>
              <MaterialCommunityIcons name={iconName} size={21} color={isFocused ? theme.colors.text : theme.colors.textMuted} />
              <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 6,
    ...theme.shadows.softCardShadow,
  },
  tab: {
    flex: 1,
    borderRadius: theme.radius.control,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabActive: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    ...theme.shadows.softControlShadow,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  labelActive: {
    color: theme.colors.text,
  },
});
