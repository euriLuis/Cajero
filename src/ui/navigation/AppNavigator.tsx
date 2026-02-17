import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProductsScreen } from '../screens/Products/ProductsScreen';
import { SaleScreen } from '../screens/Sale/SaleScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { SummaryScreen } from '../screens/Summary/SummaryScreen';
import { CashCounterScreen } from '../screens/CashCounter/CashCounterScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator();

const iconNames: Record<string, { active: string; inactive: string }> = {
    Venta: { active: 'cart', inactive: 'cart-outline' },
    Contador: { active: 'calculator-variant', inactive: 'calculator-variant-outline' },
    Resumen: { active: 'finance', inactive: 'chart-line' },
    Productos: { active: 'package-variant', inactive: 'package-variant-closed' },
    Historial: { active: 'clipboard-text-clock', inactive: 'clipboard-text-clock-outline' },
};

export const AppNavigator = () => {
    return (
        <Tab.Navigator
            initialRouteName="Venta"
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color }) => (
                    <View style={{ marginTop: focused ? -10 : 0 }}>
                        <MaterialCommunityIcons
                            name={focused ? iconNames[route.name].active : iconNames[route.name].inactive}
                            size={focused ? 35 : 24}
                            color={color}
                        />
                    </View>
                ),
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.mutedText,
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.border,
                    borderTopWidth: 1,
                    paddingBottom: 8,
                    paddingTop: 10,
                    height: 65,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    elevation: 10,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 0,
                },
            })}
        >
            <Tab.Screen
                name="Venta"
                component={SaleScreen}
                options={{ title: 'Venta' }}
            />
            <Tab.Screen
                name="Contador"
                component={CashCounterScreen}
                options={{ title: 'Contador' }}
            />
            <Tab.Screen
                name="Resumen"
                component={SummaryScreen}
                options={{ title: 'Resumen' }}
            />
            <Tab.Screen
                name="Productos"
                component={ProductsScreen}
                options={{ title: 'Productos' }}
            />
            <Tab.Screen
                name="Historial"
                component={HistoryScreen}
                options={{ title: 'Historial' }}
            />
        </Tab.Navigator>
    );
};
