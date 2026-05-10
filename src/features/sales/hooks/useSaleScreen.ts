import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { productsRepo, salesRepo } from '../../../data/repositories';
import { Product } from '../../../shared/domain/models/Product';
import { useErrorReporter, useSoftNotice } from '../../../ui/components';
import { validateQuantity } from '../../shared/utils/validation';
import { calculateCartTotal, addToCart, updateCartQty, removeFromCart as removeCartItem, combineDateWithCurrentTime, CartItem } from '../utils/cartCalculations';

export { CartItem };

export function useSaleScreen() {
    const [products, setProducts] = useState<Product[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectorModalVisible, setSelectorModalVisible] = useState(false);
    const [selectorModalMounted, setSelectorModalMounted] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [quantity, setQuantity] = useState('1');
    const [qtyError, setQtyError] = useState<string | null>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const modalTranslateY = useRef(new Animated.Value(380)).current;
    const { showNotice } = useSoftNotice();
    const { reportError } = useErrorReporter();

    // Modal animation
    useEffect(() => {
        if (selectorModalVisible) {
            if (selectorModalMounted) return;

            setSelectorModalMounted(true);
            overlayOpacity.setValue(0);
            modalTranslateY.setValue(380);

            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 130,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(modalTranslateY, {
                    toValue: 0,
                    duration: 230,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
            return;
        }

        if (!selectorModalMounted) return;

        Animated.parallel([
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 90,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(modalTranslateY, {
                toValue: 380,
                duration: 180,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) setSelectorModalMounted(false);
        });
    }, [selectorModalVisible, selectorModalMounted, overlayOpacity, modalTranslateY]);

    const loadProducts = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const list = await productsRepo.listActiveProducts();
            setProducts(list);
        } catch (error) {
            showNotice({ title: 'Error', message: 'Error al cargar productos', type: 'error' });
            reportError({
                title: 'Error cargando productos para venta',
                message: 'Error al cargar productos',
                source: 'Venta / Cargar productos',
                error,
                reproductionSteps: 'Abrir la seccion Venta o refrescar la lista de productos.',
            });
        } finally {
            setRefreshing(false);
        }
    }, [showNotice, reportError]);

    useFocusEffect(useCallback(() => {
        loadProducts();
    }, [loadProducts]));

    const handleDateChange = useCallback((event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) setSelectedDate(date);
    }, []);

    const handleSelectProduct = useCallback((product: Product) => {
        setSelectedProduct(product);
        setSelectorModalVisible(false);
        setSearchTerm('');
    }, []);

    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return products;
        const term = searchTerm.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(term));
    }, [products, searchTerm]);

    const validateQty = validateQuantity;

    const handleQuantityChange = useCallback((text: string) => {
        setQuantity(text);
        const validation = validateQty(text);
        setQtyError(validation.valid ? null : validation.error);
    }, [validateQty]);

    const handleAddToCart = useCallback(() => {
        if (!selectedProduct) {
            showNotice({ title: 'Error', message: 'Selecciona un producto', type: 'error' });
            return;
        }

        const validation = validateQty(quantity);
        if (!validation.valid) {
            setQtyError(validation.error);
            return;
        }
        const qty = validation.value;

        setCart(prev => addToCart(prev, {
            productId: selectedProduct.id,
            productNameSnapshot: selectedProduct.name,
            unitPriceSnapshotCents: selectedProduct.priceCents,
            qty
        }));

        setSelectedProduct(null);
        setQuantity('1');
        setQtyError(null);
    }, [selectedProduct, quantity, validateQty, showNotice]);

    const updateQty = useCallback((productId: number, delta: number) => {
        setCart(prev => updateCartQty(prev, productId, delta));
    }, []);

    const removeFromCart = useCallback((productId: number) => {
        setCart(prev => removeCartItem(prev, productId));
    }, []);

    const totalCents = useMemo(
        () => calculateCartTotal(cart),
        [cart]
    );

    useEffect(() => {
        salesRepo.setCurrentSaleDraftTotal(totalCents);
    }, [totalCents]);

    const handleConfirmSale = useCallback(async () => {
        if (cart.length === 0) {
            showNotice({ title: 'Carrito vacío', message: 'Añade productos antes de confirmar la venta', type: 'info' });
            return;
        }
        if (isSaving) return;

        setIsSaving(true);
        try {
            const createdAt = combineDateWithCurrentTime(selectedDate);

            await salesRepo.createSale({
                items: cart,
                createdAtMs: createdAt.getTime()
            });
            showNotice({ title: 'Venta registrada', message: 'La venta se guardó correctamente', type: 'success' });
            setCart([]);
            setSelectedDate(new Date());
        } catch (error) {
            showNotice({ title: 'Error', message: 'No se pudo registrar la venta', type: 'error' });
            reportError({
                title: 'Error registrando venta',
                message: 'No se pudo registrar la venta',
                source: 'Venta / Confirmar',
                error,
                reproductionSteps: 'Abrir Venta, agregar productos al carrito y tocar Confirmar.',
                details: `Items: ${cart.length} | Total: ${totalCents} centavos | Fecha: ${selectedDate.toISOString()}`,
            });
        } finally {
            setIsSaving(false);
        }
    }, [cart, selectedDate, isSaving, showNotice, reportError, totalCents]);

    const handleRefresh = useCallback(() => loadProducts(true), [loadProducts]);

    return {
        refreshing,
        selectedDate,
        showDatePicker,
        setShowDatePicker,
        selectedProduct,
        setSelectorModalVisible,
        selectorModalMounted,
        searchTerm,
        setSearchTerm,
        quantity,
        qtyError,
        cart,
        isSaving,
        filteredProducts,
        totalCents,
        overlayOpacity,
        modalTranslateY,
        handleDateChange,
        handleSelectProduct,
        handleQuantityChange,
        handleAddToCart,
        updateQty,
        removeFromCart,
        handleConfirmSale,
        handleRefresh,
    };
}
