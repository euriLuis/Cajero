import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ProductsScreen } from '../../features/products/screen/ProductsScreen';
import { SaleScreen } from '../../features/sales/screen/SaleScreen';
import { HistoryScreen } from '../../features/history/screen/HistoryScreen';
import { SummaryScreen } from '../../features/summary/screen/SummaryScreen';
import { CashCounterScreen } from '../../features/cash/screen/CashCounterScreen';
import { SoftTabBar } from '../components';

const Tab = createBottomTabNavigator();

export const AppNavigator = () => {
    return (
        <Tab.Navigator
            initialRouteName="Venta"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                },
            }}
            tabBar={(props) => <SoftTabBar {...props} />}
        >
            <Tab.Screen name="Venta" component={SaleScreen} options={{ title: 'Venta' }} />
            <Tab.Screen name="Contador" component={CashCounterScreen} options={{ title: 'Contador' }} />
            <Tab.Screen name="Resumen" component={SummaryScreen} options={{ title: 'Resumen' }} />
            <Tab.Screen name="Productos" component={ProductsScreen} options={{ title: 'Productos' }} />
            <Tab.Screen name="Historial" component={HistoryScreen} options={{ title: 'Historial' }} />
        </Tab.Navigator>
    );
};
