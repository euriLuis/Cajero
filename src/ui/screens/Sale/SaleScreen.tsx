import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { productsRepo, salesRepo } from '../../../data/repositories';
import { Product } from '../../../domain/models/Product';
import { formatCents } from '../../../utils/money';
import { theme } from '../../theme';
import { SoftInput, useSoftNotice } from '../../components';

interface CartItem {
    productId: number;
    productNameSnapshot: string;
    unitPriceSnapshotCents: number;
    qty: number;
}

import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateShort } from '../../../utils/dates';

export const SaleScreen = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Date
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Product selector
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectorModalVisible, setSelectorModalVisible] = useState(false);
    const [selectorModalMounted, setSelectorModalMounted] = useState(false);

    // Quantity
    const [quantity, setQuantity] = useState('1');
    const [qtyError, setQtyError] = useState<string | null>(null);

    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const insets = useSafeAreaInsets();
    const { showNotice } = useSoftNotice();

    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const modalTranslateY = useRef(new Animated.Value(380)).current;

    useEffect(() => {
        if (selectorModalVisible) {
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

        if (!selectorModalMounted) {
            return;
        }

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
            if (finished) {
                setSelectorModalMounted(false);
            }
        });
    }, [selectorModalVisible, selectorModalMounted, overlayOpacity, modalTranslateY]);

    const loadProducts = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const list = await productsRepo.listActiveProducts();
            setProducts(list);
        } catch (e) {
            showNotice({ title: 'Error', message: 'Error al cargar productos', type: 'error' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadProducts();
        }, [loadProducts])
    );

    const handleDateChange = (event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
        }
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSelectorModalVisible(false);
    };

    const validateQty = (qtyStr: string): { valid: boolean; error?: string; qty?: number } => {
        if (qtyStr.trim() === '') {
            return { valid: true, qty: 1 }; // Treat empty as 1
        }
        const qty = parseInt(qtyStr);
        if (isNaN(qty)) {
            return { valid: false, error: 'Cantidad debe ser un número' };
        }
        if (qty < 1) {
            return { valid: false, error: 'Cantidad debe ser >= 1' };
        }
        return { valid: true, qty };
    };

    const handleQuantityChange = (text: string) => {
        setQuantity(text);
        const validation = validateQty(text);
        setQtyError(validation.error || null);
    };

    const handleAddToCart = () => {
        if (!selectedProduct) {
            showNotice({ title: 'Error', message: 'Selecciona un producto', type: 'error' });
            return;
        }

        const validation = validateQty(quantity);
        if (!validation.valid) {
            setQtyError(validation.error ?? null);
            return;
        }

        const qty = validation.qty || 1;

        setCart(prev => {
            const existing = prev.find(item => item.productId === selectedProduct.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === selectedProduct.id
                        ? { ...item, qty: item.qty + qty }
                        : item
                );
            }
            return [...prev, {
                productId: selectedProduct.id,
                productNameSnapshot: selectedProduct.name,
                unitPriceSnapshotCents: selectedProduct.priceCents,
                qty
            }];
        });

        // Reset
        setSelectedProduct(null);
        setQuantity('1');
        setQtyError(null);
    };

    const updateQty = (productId: number, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.productId === productId) {
                    const newQty = item.qty + delta;
                    return newQty > 0 ? { ...item, qty: newQty } : item;
                }
                return item;
            }).filter(item => item.qty > 0);
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
    };

    const totalCents = cart.reduce((sum, item) => sum + (item.unitPriceSnapshotCents * item.qty), 0);


    useEffect(() => {
        salesRepo.setCurrentSaleDraftTotal(totalCents);
    }, [totalCents]);

    const handleConfirmSale = async () => {
        if (cart.length === 0) {
            showNotice({ title: 'Carrito vacío', message: 'Añade productos antes de confirmar la venta', type: 'info' });
            return;
        }

        if (isSaving) {
            return; // Prevenir doble-click
        }

        setIsSaving(true);
        try {
            // Combine selected date with current time
            const now = new Date();
            const createdAt = new Date(selectedDate);
            createdAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

            await salesRepo.createSale({
                items: cart,
                createdAtMs: createdAt.getTime()
            });
            showNotice({ title: 'Venta registrada', message: 'La venta se guardó correctamente', type: 'success' });
            setCart([]);
            setSelectedDate(new Date());
        } catch (e) {
            showNotice({ title: 'Error', message: 'No se pudo registrar la venta', type: 'error' });
            // NO limpiar carrito en caso de error
        } finally {
            setIsSaving(false);
        }
    };

    const renderCartItem = ({ item }: { item: CartItem }) => (
        <View style={styles.cartItem}>
            <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.productNameSnapshot}</Text>
                <Text style={styles.cartItemSubtotal}>
                    {formatCents(item.unitPriceSnapshotCents * item.qty)}
                </Text>
            </View>
            <View style={styles.cartItemControls}>
                <TouchableOpacity 
                    onPress={() => updateQty(item.productId, -1)} 
                    style={styles.qtyBtn}
                    disabled={isSaving}
                >
                    <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <TouchableOpacity 
                    onPress={() => updateQty(item.productId, 1)} 
                    style={styles.qtyBtn}
                    disabled={isSaving}
                >
                    <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => removeFromCart(item.productId)} 
                    style={styles.removeBtn}
                    disabled={isSaving}
                >
                    <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderProductInModal = ({ item }: { item: Product }) => (
        <TouchableOpacity style={styles.modalProductItem} onPress={() => handleSelectProduct(item)}>
            <Text style={styles.modalProductName}>{item.name}</Text>
            <Text style={styles.modalProductPrice}>{formatCents(item.priceCents)}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) + 4 }]}>

            <View style={styles.card}>
                {/* Date Selector */}
                <TouchableOpacity
                    style={styles.dateSelector}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={styles.dateSelectorText}>
                        Fecha: {formatDateShort(selectedDate.getTime())}
                    </Text>
                    <Text style={styles.dateSelectorIcon}>📅</Text>
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                    />
                )}

                {/* Product Selector & Quantity */}
                <View style={styles.selectorSection}>
                    <TouchableOpacity
                        style={[styles.dropdown, isSaving && styles.dropdownDisabled]}
                        onPress={() => setSelectorModalVisible(true)}
                        disabled={isSaving}
                    >
                        <Text style={selectedProduct ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                            {selectedProduct ? selectedProduct.name : 'Seleccionar producto...'}
                        </Text>
                        <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>

                    <SoftInput
                        containerStyle={styles.qtyInput}
                        size="compact"
                        value={quantity}
                        onChangeText={handleQuantityChange}
                        keyboardType="numeric"
                        placeholder="Cant."
                        editable={!isSaving}
                    />
                </View>

                {qtyError && (
                    <Text style={styles.errorText}>{qtyError}</Text>
                )}

                <TouchableOpacity 
                    style={[styles.addButton, (isSaving || qtyError || !selectedProduct) && styles.addButtonDisabled]} 
                    onPress={handleAddToCart}
                    disabled={isSaving || !!qtyError || !selectedProduct}
                >
                    <Text style={styles.addButtonText}>+ Agregar al carrito</Text>
                </TouchableOpacity>

                {/* Cart Section */}
                <View style={styles.cartHeader}>
                    <Text style={styles.cartTitle}>Carrito ({cart.length})</Text>
                </View>

                <FlatList
                    data={cart}
                    keyExtractor={item => item.productId.toString()}
                    renderItem={renderCartItem}
                    ListEmptyComponent={
                        <Text style={styles.emptyCartText}>No hay artículos en el carrito</Text>
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    contentContainerStyle={styles.cartListContent}
                    style={styles.cartList}
                    refreshing={refreshing}
                    onRefresh={() => loadProducts(true)}
                />
            </View>

            {/* Fixed Bottom Bar */}
            <View style={[styles.bottomBar, { bottom: TAB_BAR_CLEARANCE + Math.max(insets.bottom, 10) }]}>
                <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Total:</Text>
                    <Text style={styles.totalValue}>{formatCents(totalCents)}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.confirmButton, (cart.length === 0 || isSaving) && styles.confirmButtonDisabled]}
                    onPress={handleConfirmSale}
                    disabled={cart.length === 0 || isSaving}
                >
                    <Text style={styles.confirmButtonText}>{isSaving ? 'Guardando…' : 'Confirmar'}</Text>
                </TouchableOpacity>
            </View>

            {/* Product Selector Modal */}
            <Modal
                visible={selectorModalMounted}
                transparent
                animationType="none"
                onRequestClose={() => setSelectorModalVisible(false)}
            >
                <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
                    <Animated.View style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Producto</Text>
                            <TouchableOpacity onPress={() => setSelectorModalVisible(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={products}
                            keyExtractor={item => item.id.toString()}
                            renderItem={renderProductInModal}
                            ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                            style={styles.modalList}
                            ListEmptyComponent={
                                <Text style={styles.modalEmptyText}>No hay productos disponibles</Text>
                            }
                            refreshing={refreshing}
                            onRefresh={() => loadProducts(true)}
                        />
                    </Animated.View>
                </Animated.View>
            </Modal>
        </View>
    );
};

const BOTTOM_BAR_HEIGHT = 70;
const TAB_BAR_CLEARANCE = 84;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 0,
    },
    card: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.spacing.sm,
        marginHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        paddingBottom: BOTTOM_BAR_HEIGHT + TAB_BAR_CLEARANCE + 10,
    },
    dateSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.background + '40', // light tint
    },
    dateSelectorText: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.text,
    },
    dateSelectorIcon: {
        fontSize: 18,
    },
    selectorSection: {
        flexDirection: 'row',
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    dropdown: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
        borderRadius: theme.spacing.md,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    dropdownTextPlaceholder: {
        ...theme.typography.body,
        color: theme.colors.mutedText,
        fontSize: 15,
    },
    dropdownTextSelected: {
        ...theme.typography.body,
        color: theme.colors.text,
        fontWeight: '500',
        fontSize: 15,
    },
    dropdownArrow: {
        fontSize: 12,
        color: theme.colors.mutedText,
        fontWeight: '600',
    },
    dropdownDisabled: {
        backgroundColor: theme.colors.card,
        opacity: 0.6,
    },
    qtyInput: {
        width: 75,
        backgroundColor: '#F0FDF4',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.spacing.md,
        borderWidth: 1.5,
        borderColor: theme.colors.primary,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.primary,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    addButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        marginHorizontal: theme.spacing.md,
        borderRadius: theme.spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    addButtonDisabled: {
        backgroundColor: theme.colors.disabled,
        opacity: 0.6,
        shadowOpacity: 0.08,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '600',
        marginHorizontal: theme.spacing.md,
        marginTop: -theme.spacing.sm,
        marginBottom: theme.spacing.sm,
    },
    cartHeader: {
        padding: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        marginTop: theme.spacing.md,
    },
    cartTitle: {
        ...theme.typography.title,
        fontSize: 18,
    },
    cartList: {
        flex: 1,
    },
    cartListContent: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    cartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
    },
    cartItemInfo: {
        flex: 1,
    },
    cartItemName: {
        ...theme.typography.body,
        fontSize: 15,
    },
    cartItemSubtotal: {
        ...theme.typography.caption,
        fontWeight: '600',
        marginTop: 2,
    },
    cartItemControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    qtyBtn: {
        width: 32,
        height: 32,
        borderRadius: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderWidth: 1.5,
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    qtyBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.primary,
    },
    qtyText: {
        fontSize: 14,
        minWidth: 20,
        textAlign: 'center',
        fontWeight: '600',
    },
    removeBtn: {
        width: 32,
        height: 32,
        borderRadius: theme.spacing.sm,
        backgroundColor: '#FEF2F2',
        borderWidth: 1.5,
        borderColor: '#FECACA',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: theme.spacing.xs,
        shadowColor: theme.colors.danger,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    removeBtnText: {
        fontSize: 18,
        color: theme.colors.danger,
        fontWeight: '700',
    },
    separator: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    emptyCartText: {
        textAlign: 'center',
        color: theme.colors.mutedText,
        paddingVertical: theme.spacing.lg,
    },
    bottomBar: {
        position: 'absolute',
        bottom: TAB_BAR_CLEARANCE,
        left: 0,
        right: 0,
        height: BOTTOM_BAR_HEIGHT,
        backgroundColor: theme.colors.surface,
        borderTopWidth: 2,
        borderTopColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.md,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    totalSection: {
        flex: 1,
    },
    totalLabel: {
        ...theme.typography.caption,
        color: theme.colors.mutedText,
    },
    totalValue: {
        ...theme.typography.title,
        fontSize: 22,
        color: theme.colors.text,
    },
    confirmButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.spacing.md,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    confirmButtonDisabled: {
        backgroundColor: theme.colors.disabled,
        opacity: 0.6,
        shadowOpacity: 0.08,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.spacing.md,
        borderTopRightRadius: theme.spacing.md,
        maxHeight: '80%',
        paddingBottom: theme.spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    modalTitle: {
        ...theme.typography.title,
        fontSize: 18,
    },
    modalClose: {
        fontSize: 24,
        color: theme.colors.mutedText,
        paddingHorizontal: theme.spacing.sm,
    },
    modalSearch: {
        marginHorizontal: theme.spacing.md,
        marginVertical: theme.spacing.md,
    },
    modalList: {
        maxHeight: 400,
    },
    modalProductItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: theme.spacing.md,
        marginHorizontal: theme.spacing.md,
    },
    modalProductName: {
        ...theme.typography.body,
        flex: 1,
    },
    modalProductPrice: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.primary,
    },
    modalSeparator: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginHorizontal: theme.spacing.md,
    },
    modalEmptyText: {
        textAlign: 'center',
        color: theme.colors.mutedText,
        padding: theme.spacing.lg,
    },
});
