import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ProductsScreen } from '../screens/Products/ProductsScreen';
import { SaleScreen } from '../screens/Sale/SaleScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { SummaryScreen } from '../screens/Summary/SummaryScreen';
import { CashCounterScreen } from '../screens/CashCounter/CashCounterScreen';
import { SoftTabBar } from '../components';

const Tab = createBottomTabNavigator();

export const AppNavigator = () => {
    return (
        <Tab.Navigator
            initialRouteName="Venta"
            screenOptions={{
                headerShown: false,
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
