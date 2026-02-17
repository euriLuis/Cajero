import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { productsRepo } from '../../../data/repositories';
import { Product } from '../../../domain/models/Product';
import { formatCents, parseMoneyToCents } from '../../../utils/money';
import { theme, radius } from '../../theme';

// 2) Optimized Row Component
const ProductRow = memo(({ product, onPress }: { product: Product; onPress: (p: Product) => void }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => onPress(product)}>
        <Text style={styles.itemName}>{product.name}</Text>
        <Text style={styles.itemPrice}>{formatCents(product.priceCents)}</Text>
    </TouchableOpacity>
));

export const ProductsScreen = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formName, setFormName] = useState('');
    const [formPrice, setFormPrice] = useState('');

    const loadProducts = useCallback(async (searchTerm: string) => {
        setLoading(true);
        try {
            const list = await productsRepo.listActiveProducts(searchTerm);
            setProducts(list);
        } catch (e) {
            Alert.alert('Error', 'No se pudieron cargar los productos');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadProducts('');
    }, [loadProducts]);

    // 1) Debounced Search
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            loadProducts(search);
        }, 400); // 400ms debounce for search

        return () => clearTimeout(debounceTimer);
    }, [search, loadProducts]);

    const handleOpenAdd = useCallback(() => {
        setEditingProduct(null);
        setFormName('');
        setFormPrice('');
        setModalVisible(true);
    }, []);

    const handleOpenEdit = useCallback((prod: Product) => {
        setEditingProduct(prod);
        setFormName(prod.name);
        setFormPrice((prod.priceCents / 100).toString());
        setModalVisible(true);
    }, []);

    const handleSave = useCallback(async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'El nombre es requerido');
            return;
        }

        const priceCents = parseMoneyToCents(formPrice);

        try {
            if (editingProduct) {
                await productsRepo.updateProduct(editingProduct.id, { name: formName, priceCents });
            } else {
                await productsRepo.createProduct(formName, priceCents);
            }
            setModalVisible(false);
            loadProducts(search);
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar el producto');
        }
    }, [editingProduct, formName, formPrice, search, loadProducts]);

    const handleDeactivate = useCallback(async () => {
        if (!editingProduct) return;

        Alert.alert(
            'Confirmar',
            '¿Desea desactivar este producto?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Desactivar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await productsRepo.deactivateProduct(editingProduct.id);
                            setModalVisible(false);
                            loadProducts(search);
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo desactivar');
                        }
                    }
                }
            ]
        );
    }, [editingProduct, search, loadProducts]);

    const renderHeader = useMemo(() => (
        <View style={styles.headerContainer}>
            <View style={styles.topBar}>
                <TextInput
                    style={styles.input}
                    placeholder="Buscar producto..."
                    value={search}
                    onChangeText={setSearch}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleOpenAdd}>
                    <Text style={styles.addButtonText}>Agregar</Text>
                </TouchableOpacity>
            </View>
        </View>
    ), [search, handleOpenAdd]);

    const renderItem = useCallback(({ item }: { item: Product }) => (
        <ProductRow product={item} onPress={handleOpenEdit} />
    ), [handleOpenEdit]);

    const renderEmpty = useCallback(() => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay productos</Text>
        </View>
    ), []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Productos</Text>
            </View>

            <View style={styles.card}>
                <FlatList
                    data={products}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={() => loadProducts(search)}

                    // 3) FlatList Optimizations
                    removeClippedSubviews={true}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    updateCellsBatchingPeriod={50}
                    windowSize={7}
                />
            </View>

            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                        </Text>

                        <Text style={styles.label}>Nombre</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={formName}
                            onChangeText={setFormName}
                            placeholder="Nombre del producto"
                        />

                        <Text style={styles.label}>Precio</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={formPrice}
                            onChangeText={setFormPrice}
                            placeholder="0.00"
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>

                            {editingProduct && (
                                <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={handleDeactivate}>
                                    <Text style={styles.deleteButtonText}>Desactivar</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingTop: theme.spacing.lg + 20,
        paddingBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.background,
    },
    title: {
        ...theme.typography.title,
        color: theme.colors.text,
    },
    card: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: radius.lg,
        marginHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    headerContainer: {
        padding: theme.spacing.md,
    },
    topBar: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    input: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: theme.spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.text,
    },
    addButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.md,
        justifyContent: 'center',
        borderRadius: radius.lg,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    listContent: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
    },
    itemName: {
        ...theme.typography.body,
        color: theme.colors.text,
        flex: 1,
    },
    itemPrice: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.text,
    },
    separator: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    emptyContainer: {
        paddingVertical: theme.spacing.lg,
        alignItems: 'center',
    },
    emptyText: {
        ...theme.typography.body,
        color: theme.colors.mutedText,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: radius.lg,
        padding: theme.spacing.lg,
    },
    modalTitle: {
        ...theme.typography.title,
        marginBottom: theme.spacing.lg,
        textAlign: 'center',
    },
    label: {
        ...theme.typography.caption,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
        fontWeight: '600',
        fontSize: 13,
    },
    modalInput: {
        backgroundColor: '#F9FAFB',
        padding: theme.spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        marginBottom: theme.spacing.md,
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.text,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
    },
    modalButton: {
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: radius.lg,
        minWidth: 80,
        alignItems: 'center',
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
    },
    cancelButtonText: {
        color: theme.colors.text,
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    deleteButtonText: {
        color: '#EF4444',
        fontWeight: '700',
    },
});
