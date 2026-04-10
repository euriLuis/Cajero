import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { Product } from '../../../shared/domain/models/Product';
import { formatCents } from '../../../shared/utils/money';
import { theme } from '../../../ui/theme';
import { SoftCard, SoftSearchInput, SoftButton, SoftInput } from '../../../ui/components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProductsScreen } from '../hooks/useProductsScreen';

const ProductRow = memo(({ product, onPress }: { product: Product; onPress: (p: Product) => void }) => (
    <TouchableOpacity onPress={() => onPress(product)} activeOpacity={0.9}>
        <SoftCard style={styles.itemCard}>
            <Text style={styles.itemName}>{product.name}</Text>
            <Text style={styles.itemPrice}>{formatCents(product.priceCents)}</Text>
        </SoftCard>
    </TouchableOpacity>
));

export const ProductsScreen = () => {
    const insets = useSafeAreaInsets();
    const {
        products,
        search,
        setSearch,
        loading,
        modalVisible,
        setModalVisible,
        editingProduct,
        formName,
        setFormName,
        formPrice,
        setFormPrice,
        handleOpenAdd,
        handleOpenEdit,
        handleSave,
        handleDeactivate,
        handleRefresh,
    } = useProductsScreen();

    const renderHeader = useMemo(() => (
        <View style={styles.headerContainer}>
            <View style={styles.topBar}>
                <SoftSearchInput
                    containerStyle={styles.searchInput}
                    placeholder="Buscar producto..."
                    value={search}
                    onChangeText={setSearch}
                />
                <SoftButton label="＋ Agregar producto" onPress={handleOpenAdd} style={styles.addProductBtn} />
            </View>
        </View>
    ), [search, setSearch, handleOpenAdd]);

    const renderItem = useCallback(({ item }: { item: Product }) => (
        <ProductRow product={item} onPress={handleOpenEdit} />
    ), [handleOpenEdit]);

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) + 4 }]}>

            <FlatList
                data={products}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay productos</Text>}
                contentContainerStyle={styles.listContent}
                refreshing={loading}
                onRefresh={handleRefresh}
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
    container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 10 },
    headerContainer: { paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.sm },
    topBar: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
    searchInput: { flexBasis: '50%', flexGrow: 0, flexShrink: 1 },
    addProductBtn: { minHeight: 48, paddingHorizontal: theme.spacing.lg, backgroundColor: theme.colors.surface },
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
