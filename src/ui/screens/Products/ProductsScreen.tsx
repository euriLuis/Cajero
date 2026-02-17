import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert } from 'react-native';
import { productsRepo } from '../../../data/repositories';
import { Product } from '../../../domain/models/Product';
import { formatCents, parseMoneyToCents } from '../../../utils/money';
import { theme } from '../../theme';
import { SoftCard, SoftInput, SoftButton } from '../../components';

const ProductRow = memo(({ product, onPress }: { product: Product; onPress: (p: Product) => void }) => (
    <TouchableOpacity onPress={() => onPress(product)} activeOpacity={0.9}>
        <SoftCard style={styles.itemCard}>
            <Text style={styles.itemName}>{product.name}</Text>
            <Text style={styles.itemPrice}>{formatCents(product.priceCents)}</Text>
        </SoftCard>
    </TouchableOpacity>
));

export const ProductsScreen = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formName, setFormName] = useState('');
    const [formPrice, setFormPrice] = useState('');

    const loadProducts = useCallback(async (searchTerm: string) => {
        setLoading(true);
        try {
            const list = await productsRepo.listActiveProducts(searchTerm);
            setProducts(list);
        } catch {
            Alert.alert('Error', 'No se pudieron cargar los productos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProducts(''); }, [loadProducts]);

    useEffect(() => {
        const debounceTimer = setTimeout(() => loadProducts(search), 350);
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
        if (!formName.trim()) return Alert.alert('Error', 'El nombre es requerido');
        const priceCents = parseMoneyToCents(formPrice);

        try {
            if (editingProduct) await productsRepo.updateProduct(editingProduct.id, { name: formName, priceCents });
            else await productsRepo.createProduct(formName, priceCents);

            setModalVisible(false);
            loadProducts(search);
        } catch {
            Alert.alert('Error', 'No se pudo guardar el producto');
        }
    }, [editingProduct, formName, formPrice, search, loadProducts]);

    const handleDeactivate = useCallback(async () => {
        if (!editingProduct) return;
        Alert.alert('Confirmar', '¿Desea desactivar este producto?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Desactivar',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await productsRepo.deactivateProduct(editingProduct.id);
                        setModalVisible(false);
                        loadProducts(search);
                    } catch {
                        Alert.alert('Error', 'No se pudo desactivar');
                    }
                },
            },
        ]);
    }, [editingProduct, search, loadProducts]);

    const renderHeader = useMemo(() => (
        <View style={styles.headerContainer}>
            <View style={styles.topBar}>
                <SoftInput
                    icon="⌕"
                    style={styles.searchInput}
                    placeholder="Buscar producto..."
                    value={search}
                    onChangeText={setSearch}
                />
                <SoftButton label="Agregar" onPress={handleOpenAdd} />
            </View>
        </View>
    ), [search, handleOpenAdd]);

    const renderItem = useCallback(({ item }: { item: Product }) => (
        <ProductRow product={item} onPress={handleOpenEdit} />
    ), [handleOpenEdit]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Productos</Text>
            </View>

            <FlatList
                data={products}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay productos</Text>}
                contentContainerStyle={styles.listContent}
                refreshing={loading}
                onRefresh={() => loadProducts(search)}
                removeClippedSubviews={true}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
            />

            <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <SoftCard style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</Text>
                        <Text style={styles.label}>Nombre</Text>
                        <SoftInput value={formName} onChangeText={setFormName} placeholder="Nombre del producto" />
                        <Text style={styles.label}>Precio</Text>
                        <SoftInput value={formPrice} onChangeText={setFormPrice} placeholder="0.00" keyboardType="numeric" />

                        <View style={styles.modalButtons}>
                            <SoftButton label="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} />
                            {editingProduct ? <SoftButton label="Desactivar" variant="danger" onPress={handleDeactivate} /> : null}
                            <SoftButton label="Guardar" onPress={handleSave} />
                        </View>
                    </SoftCard>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingTop: 40, paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.sm },
    title: { ...theme.typography.title, color: theme.colors.text },
    headerContainer: { paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.sm },
    topBar: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
    searchInput: { minWidth: 190 },
    listContent: { paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.xl, gap: theme.spacing.sm },
    itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.md },
    itemName: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
    itemPrice: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    emptyText: { textAlign: 'center', color: theme.colors.textMuted, paddingVertical: theme.spacing.xl },
    modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: theme.spacing.lg },
    modalContent: { padding: theme.spacing.lg },
    modalTitle: { ...theme.typography.subtitle, color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.md },
    label: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
    modalButtons: { flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end', marginTop: theme.spacing.md },
});
