import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert } from 'react-native';
import { salesRepo, productsRepo } from '../../../data/repositories';
import { Sale } from '../../../domain/models/Sale';
import { SaleItem } from '../../../domain/models/SaleItem';
import { Product } from '../../../domain/models/Product';
import { formatCents, parseMoneyToCents } from '../../../utils/money';
import { getDayRangeMs, formatDateShort, formatTimeNoSeconds, formatDateTimeWithSeconds } from '../../../utils/dates';
import { theme } from '../../theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SoftInput, useSoftNotice } from '../../components';

// 2) Optimized Row Components
const SaleRow = memo(({
    item,
    summary,
    onOpenDetail
}: {
    item: Sale;
    summary: string;
    onOpenDetail: (sale: Sale) => void;
}) => (
    <TouchableOpacity style={styles.saleRow} onPress={() => onOpenDetail(item)}>
        <View style={styles.saleInfo}>
            <Text style={styles.saleTime}>{formatTimeNoSeconds(item.createdAt)}</Text>
            <Text style={styles.saleDate}>{formatDateShort(item.createdAt)}</Text>
            <Text style={styles.saleSummary} numberOfLines={1} ellipsizeMode="tail">
                {summary || '…'}
            </Text>
        </View>
        <Text style={styles.saleTotal}>{formatCents(item.totalCents)}</Text>
    </TouchableOpacity>
));

const SaleDetailItemRow = memo(({
    item,
    isEditMode,
    draft,
    error,
    onQtyChange,
    onPriceChange,
    onIncrement,
    onDecrement,
    onDelete,
    onRestore
}: {
    item: SaleItem;
    isEditMode: boolean;
    draft: { qty: string; price: string; deleted?: boolean; _newItem?: boolean; _productId?: number; _productNameSnapshot?: string; _unitPriceSnapshotCents?: number };
    error?: string;
    onQtyChange: (id: number, val: string) => void;
    onPriceChange: (id: number, val: string) => void;
    onIncrement: (id: number) => void;
    onDecrement: (id: number) => void;
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}) => {
    const isDeleted = draft.deleted || false;
    const displayQty = draft.qty !== '' ? parseInt(draft.qty || '0') || item.qty : item.qty;
    const displayPrice = draft.price !== '' ? parseMoneyToCents(draft.price || '0') : item.unitPriceSnapshotCents;
    const displayLineTotal = displayQty * displayPrice;

    return (
        <View style={styles.itemRow}>
            {!isEditMode ? (
                <>
                    <View style={styles.itemNameCol}>
                        <Text style={styles.itemNameSnp}>{item.productNameSnapshot}</Text>
                        <Text style={styles.itemPriceSnp}>{formatCents(item.unitPriceSnapshotCents)} c/u</Text>
                    </View>
                    <View style={styles.itemQtyCol}>
                        <Text style={styles.itemQtyText}>x{item.qty}</Text>
                        <Text style={styles.itemSubtotalSnp}>{formatCents(item.lineTotalCents)}</Text>
                    </View>
                </>
            ) : (
                <View style={[styles.editItemContainer, isDeleted && styles.deletedItemContainer]}>
                    {isDeleted ? (
                        <View style={styles.deletedOverlay}>
                            <Text style={styles.deletedText}>Marcado para eliminar</Text>
                            <TouchableOpacity style={styles.restoreBtn} onPress={() => onRestore(item.id)}>
                                <Text style={styles.restoreBtnText}>↶ Restaurar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={styles.editItemHeader}>
                                <Text style={styles.itemNameSnp}>{item.productNameSnapshot}</Text>
                                <TouchableOpacity style={styles.deleteItemIconBtn} onPress={() => onDelete(item.id)}>
                                    <Text style={styles.deleteItemIcon}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.originalValuesRow}>
                                <Text style={styles.originalValueText}>
                                    Cant: <Text style={styles.originalValueBold}>{item.qty}</Text>
                                </Text>
                                <Text style={styles.originalValueText}>
                                    P: <Text style={styles.originalValueBold}>{formatCents(item.unitPriceSnapshotCents)}</Text>
                                </Text>
                            </View>

                            <View style={styles.editRow}>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Cant.</Text>
                                    <View style={styles.qtyControlRow}>
                                        <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrement(item.id)}>
                                            <Text style={styles.qtyBtnText}>−</Text>
                                        </TouchableOpacity>
                                        <SoftInput
                                            containerStyle={styles.editInput}
                                            size="compact"
                                            keyboardType="number-pad"
                                            value={draft.qty}
                                            onChangeText={(t) => onQtyChange(item.id, t)}
                                            placeholder={item.qty.toString()}
                                        />
                                        <TouchableOpacity style={styles.qtyBtn} onPress={() => onIncrement(item.id)}>
                                            <Text style={styles.qtyBtnText}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Precio</Text>
                                    <SoftInput
                                        containerStyle={[styles.editInput, !!error && styles.inputError]}
                                        size="compact"
                                        keyboardType="decimal-pad"
                                        value={draft.price}
                                        onChangeText={(t) => onPriceChange(item.id, t)}
                                        placeholder={formatCents(item.unitPriceSnapshotCents)}
                                    />
                                </View>
                            </View>

                            <View style={styles.editSubtotal}>
                                <Text style={styles.editSubtotalValue}>{formatCents(displayLineTotal)}</Text>
                            </View>
                        </>
                    )}
                </View>
            )}
        </View>
    );
});

export const HistoryScreen = () => {
    const insets = useSafeAreaInsets();
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    // Detail Modal
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    // Edit mode
    const [isEditMode, setIsEditMode] = useState(false);
    type EditDraft = { qty: string; price: string; deleted?: boolean; _newItem?: boolean; _productId?: number; _productNameSnapshot?: string; _unitPriceSnapshotCents?: number };
    const [editedItems, setEditedItems] = useState<Map<number, EditDraft>>(new Map());
    const [editErrors, setEditErrors] = useState<Map<number, string>>(new Map());

    // Add product in edit mode
    const [editProducts, setEditProducts] = useState<Product[]>([]);
    const [editProductSelectorVisible, setEditProductSelectorVisible] = useState(false);
    const [editSelectedProduct, setEditSelectedProduct] = useState<Product | null>(null);
    const [editAddQty, setEditAddQty] = useState('1');
    const [editProductSearch, setEditProductSearch] = useState('');

    // Items summary
    const [itemsSummaryBySaleId, setItemsSummaryBySaleId] = useState<Record<number, string>>({});
    const { showNotice } = useSoftNotice();

    const loadSales = useCallback(async () => {
        setLoading(true);
        try {
            const { startMs, endMs } = getDayRangeMs(currentDate);
            const list = await salesRepo.listSalesByRange(startMs, endMs);
            setSales(list);

            if (list.length > 0) {
                const saleIds = list.map(s => s.id);
                const summaryMap = await salesRepo.getSaleItemsSummaryMap(saleIds);
                setItemsSummaryBySaleId(summaryMap);
            } else {
                setItemsSummaryBySaleId({});
            }
        } catch (e) {
            showNotice({ title: 'Error', message: 'No se pudieron cargar las ventas', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [currentDate]);

    useFocusEffect(
        useCallback(() => {
            loadSales();
        }, [loadSales])
    );

    const handleQuickDate = useCallback((type: 'today' | 'yesterday') => {
        const newDate = new Date();
        if (type === 'yesterday') {
            newDate.setDate(newDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    }, []);

    const onPickerChange = useCallback((event: any, selectedDate?: Date) => {
        setShowPicker(false);
        if (selectedDate) {
            setCurrentDate(selectedDate);
        }
    }, []);

    const handleEditModeToggle = useCallback(() => {
        if (isEditMode) {
            setIsEditMode(false);
            setEditedItems(new Map());
            setEditErrors(new Map());
            setEditSelectedProduct(null);
            setEditAddQty('1');
            setEditProductSearch('');
        } else {
            if (saleItems.length === 0) {
                showNotice({ title: 'Error', message: 'No hay productos para editar', type: 'error' });
                return;
            }
            const initialDraft = new Map<number, EditDraft>();
            for (const item of saleItems) {
                initialDraft.set(item.id, { qty: '', price: '' });
            }
            setEditedItems(initialDraft);
            setEditErrors(new Map());
            setIsEditMode(true);
            // Load active products for adding new items
            productsRepo.listActiveProducts().then(setEditProducts).catch(() => {});
        }
    }, [isEditMode, saleItems]);

    const handleItemQtyChange = useCallback((itemId: number, qty: string) => {
        setEditedItems(prev => {
            const updated = new Map(prev);
            const current = updated.get(itemId) ?? { qty: '', price: '' };
            updated.set(itemId, { ...current, qty });
            return updated;
        });

        setEditErrors(prev => {
            const errors = new Map(prev);
            if (qty !== '') {
                const qtyNum = parseInt(qty);
                if (isNaN(qtyNum) || qtyNum < 1) errors.set(itemId, 'Cantidad debe ser >= 1');
                else errors.delete(itemId);
            } else errors.delete(itemId);
            return errors;
        });
    }, []);

    const handleItemPriceChange = useCallback((itemId: number, price: string) => {
        setEditedItems(prev => {
            const updated = new Map(prev);
            const current = updated.get(itemId) ?? { qty: '', price: '' };
            updated.set(itemId, { ...current, price });
            return updated;
        });

        setEditErrors(prev => {
            const errors = new Map(prev);
            if (price !== '') {
                const priceCents = parseMoneyToCents(price);
                if (isNaN(priceCents) || priceCents < 0) errors.set(itemId, 'Precio inválido');
                else errors.delete(itemId);
            } else errors.delete(itemId);
            return errors;
        });
    }, []);

    const handleDeleteItem = useCallback((itemId: number) => {
        setEditedItems(prev => {
            const updated = new Map(prev);
            const current = updated.get(itemId) ?? { qty: '', price: '' };
            updated.set(itemId, { ...current, deleted: true });
            return updated;
        });
    }, []);

    const handleRestoreItem = useCallback((itemId: number) => {
        setEditedItems(prev => {
            const updated = new Map(prev);
            const current = updated.get(itemId) ?? { qty: '', price: '' };
            const { deleted, ...rest } = current;
            updated.set(itemId, rest);
            return updated;
        });
    }, []);

    const handleAddProductToSale = useCallback(() => {
        if (!editSelectedProduct) {
            showNotice({ title: 'Error', message: 'Selecciona un producto', type: 'error' });
            return;
        }
        const qty = parseInt(editAddQty || '1');
        if (isNaN(qty) || qty < 1) {
            showNotice({ title: 'Error', message: 'Cantidad debe ser >= 1', type: 'error' });
            return;
        }

        // Check if product already exists in saleItems
        const existing = saleItems.find(si => si.productId === editSelectedProduct.id);
        if (existing) {
            // Sum qty to existing item's draft
            const draft = editedItems.get(existing.id) ?? { qty: '', price: '' };
            const currentQty = draft.qty !== '' ? parseInt(draft.qty || '0') || existing.qty : existing.qty;
            handleItemQtyChange(existing.id, (currentQty + qty).toString());
        } else {
            // Add as new temporary item with negative key
            const tempKey = -Date.now();
            setEditedItems(prev => {
                const updated = new Map(prev);
                updated.set(tempKey, {
                    qty: qty.toString(),
                    price: (editSelectedProduct.priceCents / 100).toString(),
                    _newItem: true,
                    _productId: editSelectedProduct.id,
                    _productNameSnapshot: editSelectedProduct.name,
                    _unitPriceSnapshotCents: editSelectedProduct.priceCents,
                });
                return updated;
            });
        }

        setEditSelectedProduct(null);
        setEditAddQty('1');
    }, [editSelectedProduct, editAddQty, saleItems, editedItems, handleItemQtyChange]);

    const handleQtyIncrement = useCallback((itemId: number) => {
        const item = saleItems.find(i => i.id === itemId);
        if (!item) return;
        const draft = editedItems.get(itemId) ?? { qty: '', price: '' };
        const currentQty = draft.qty !== '' ? parseInt(draft.qty || '0') || item.qty : item.qty;
        handleItemQtyChange(itemId, (currentQty + 1).toString());
    }, [saleItems, editedItems, handleItemQtyChange]);

    const handleQtyDecrement = useCallback((itemId: number) => {
        const item = saleItems.find(i => i.id === itemId);
        if (!item) return;
        const draft = editedItems.get(itemId) ?? { qty: '', price: '' };
        const currentQty = draft.qty !== '' ? parseInt(draft.qty || '0') || item.qty : item.qty;
        if (currentQty > 1) handleItemQtyChange(itemId, (currentQty - 1).toString());
    }, [saleItems, editedItems, handleItemQtyChange]);

    const editedTotalMain = useMemo(() => {
        let total = 0;
        for (const item of saleItems) {
            const draft = editedItems.get(item.id) ?? { qty: '', price: '' };
            if (draft.deleted) continue;
            let qty = item.qty;
            let price = item.unitPriceSnapshotCents;
            if (draft.qty !== '') qty = parseInt(draft.qty) || 0;
            if (draft.price !== '') price = parseMoneyToCents(draft.price);
            total += qty * price;
        }
        // Include new temporary items
        for (const [key, draft] of editedItems) {
            if (key < 0 && (draft as any)._newItem) {
                if (draft.deleted) continue;
                const qty = parseInt(draft.qty) || 0;
                const price = draft.price !== '' ? parseMoneyToCents(draft.price) : (draft as any)._unitPriceSnapshotCents;
                total += qty * price;
            }
        }
        return total;
    }, [saleItems, editedItems]);

    const handleSaveEdits = useCallback(async () => {
        if (editErrors.size > 0 || !selectedSale) {
            showNotice({ title: 'Error', message: 'Revisa los campos con errores', type: 'error' });
            return;
        }

        try {
            const edits: any[] = [];
            for (const [itemId, draft] of editedItems) {
                if (draft.deleted) edits.push({ type: 'delete', itemId });
                else if ((draft as any)._newItem) {
                    // New item to add
                    edits.push({
                        type: 'add',
                        productId: (draft as any)._productId,
                        productNameSnapshot: (draft as any)._productNameSnapshot,
                        unitPriceSnapshotCents: draft.price !== '' ? parseMoneyToCents(draft.price) : (draft as any)._unitPriceSnapshotCents,
                        qty: parseInt(draft.qty) || 1
                    });
                } else if (draft.qty !== '' || draft.price !== '') {
                    const item = saleItems.find(i => i.id === itemId);
                    if (!item) continue;
                    edits.push({
                        type: 'update',
                        itemId,
                        qty: draft.qty !== '' ? parseInt(draft.qty) : item.qty,
                        unitPriceSnapshotCents: draft.price !== '' ? parseMoneyToCents(draft.price) : item.unitPriceSnapshotCents
                    });
                }
            }

            if (edits.length > 0) await salesRepo.applySaleEdits(selectedSale.id, edits);

            const updatedItems = await salesRepo.getSaleItems(selectedSale.id);
            setSaleItems(updatedItems);

            if (updatedItems.length === 0) {
                setDetailModalVisible(false);
                await loadSales();
            } else {
                setIsEditMode(false);
                setEditedItems(new Map());
                await loadSales();
                showNotice({ title: 'Éxito', message: 'Cambios guardados', type: 'success' });
            }
        } catch (e) {
            showNotice({ title: 'Error', message: 'No se pudieron guardar los cambios', type: 'error' });
        }
    }, [editErrors, selectedSale, editedItems, saleItems, loadSales]);

    const handleDeleteSale = useCallback(() => {
        if (!selectedSale) return;
        Alert.alert('Eliminar venta', 'No se puede deshacer. ¿Seguro?', [
            { text: 'Cancelar' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await salesRepo.deleteSale(selectedSale.id);
                        setDetailModalVisible(false);
                        await loadSales();
                        showNotice({ title: 'Éxito', message: 'Venta eliminada', type: 'success' });
                    } catch (e) {
                        showNotice({ title: 'Error', message: 'No se pudo eliminar', type: 'error' });
                    }
                }
            }
        ]);
    }, [selectedSale, loadSales]);

    const handleOpenDetail = useCallback(async (sale: Sale) => {
        try {
            const items = await salesRepo.getSaleItems(sale.id);
            setSaleItems(items);
            setSelectedSale(sale);
            setIsEditMode(false);
            setEditedItems(new Map());
            setDetailModalVisible(true);
        } catch (e) {
            showNotice({ title: 'Error', message: 'No se pudieron traer los detalles', type: 'error' });
        }
    }, []);

    const renderSaleItem = useCallback(({ item }: { item: Sale }) => (
        <SaleRow
            item={item}
            summary={itemsSummaryBySaleId[item.id]}
            onOpenDetail={handleOpenDetail}
        />
    ), [itemsSummaryBySaleId, handleOpenDetail]);

    const renderHeader = useMemo(() => (
        <View style={styles.filterSection}>
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.filterBtn, formatDateShort(currentDate.getTime()) === formatDateShort(new Date().getTime()) && styles.activeFilter]}
                    onPress={() => handleQuickDate('today')}
                >
                    <Text style={styles.filterBtnText}>Hoy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterBtn, formatDateShort(currentDate.getTime()) === formatDateShort(new Date().getTime() - 86400000) && styles.activeFilter]}
                    onPress={() => handleQuickDate('yesterday')}
                >
                    <Text style={styles.filterBtnText}>Ayer</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
                <Text style={styles.dateSelectorText}>
                    {formatDateShort(currentDate.getTime())} 📅
                </Text>
            </TouchableOpacity>

            {showPicker && (
                <DateTimePicker
                    value={currentDate}
                    mode="date"
                    display="default"
                    onChange={onPickerChange}
                />
            )}
        </View>
    ), [currentDate, handleQuickDate, onPickerChange, showPicker]);

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) + 4 }]}>

            <View style={styles.card}>
                <FlatList
                    data={sales}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderSaleItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay ventas registradas</Text>}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={loadSales}

                    // Perf optimizations
                    removeClippedSubviews={true}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            </View>

            <Modal
                visible={detailModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detalle de Venta</Text>
                            <View style={styles.modalHeaderActions}>
                                <TouchableOpacity style={[styles.headerBtn, styles.headerEditBtn]} onPress={handleEditModeToggle}>
                                    <Text style={styles.headerBtnText}>✏️ Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.headerBtn, styles.headerDeleteBtn]} onPress={handleDeleteSale}>
                                    <Text style={styles.headerBtnText}>🗑️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                    <Text style={styles.modalClose}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {selectedSale && (
                            <View style={styles.detailSummary}>
                                <Text style={styles.detailText}>ID: {selectedSale.id}</Text>
                                <Text style={styles.detailText}>{formatDateTimeWithSeconds(selectedSale.createdAt)}</Text>
                                <Text style={[styles.detailText, styles.detailTotal]}>
                                    Total: {formatCents(isEditMode ? editedTotalMain : selectedSale.totalCents)}
                                </Text>
                            </View>
                        )}

                        <FlatList
                            data={saleItems}
                            keyExtractor={item => item.id.toString()}
                            renderItem={({ item }) => (
                                <SaleDetailItemRow
                                    item={item}
                                    isEditMode={isEditMode}
                                    draft={editedItems.get(item.id) ?? { qty: '', price: '' }}
                                    error={editErrors.get(item.id)}
                                    onQtyChange={handleItemQtyChange}
                                    onPriceChange={handleItemPriceChange}
                                    onIncrement={handleQtyIncrement}
                                    onDecrement={handleQtyDecrement}
                                    onDelete={handleDeleteItem}
                                    onRestore={handleRestoreItem}
                                />
                            )}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            style={styles.itemsList}
                            initialNumToRender={8}
                        />

                        {isEditMode && (
                            <View style={styles.addProductSection}>
                                <Text style={styles.addProductSectionTitle}>Agregar producto a la venta</Text>

                                {/* Product Selector Button */}
                                <TouchableOpacity
                                    style={styles.addProductSelector}
                                    onPress={() => setEditProductSelectorVisible(true)}
                                >
                                    <Text style={editSelectedProduct ? styles.addProductSelectorSelected : styles.addProductSelectorPlaceholder}>
                                        {editSelectedProduct ? editSelectedProduct.name : 'Seleccionar producto...'}
                                    </Text>
                                    <Text style={styles.addProductSelectorArrow}>▼</Text>
                                </TouchableOpacity>

                                {/* Qty + Add Button Row */}
                                <View style={styles.addProductRow}>
                                    <SoftInput
                                        containerStyle={styles.addProductQtyInput}
                                        size="compact"
                                        value={editAddQty}
                                        onChangeText={setEditAddQty}
                                        keyboardType="numeric"
                                        placeholder="Cant."
                                    />
                                    <TouchableOpacity
                                        style={[styles.addProductBtn, !editSelectedProduct && styles.addProductBtnDisabled]}
                                        onPress={handleAddProductToSale}
                                        disabled={!editSelectedProduct}
                                    >
                                        <Text style={styles.addProductBtnText}>+ Agregar</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Product Selector Modal */}
                                <Modal
                                    visible={editProductSelectorVisible}
                                    transparent
                                    animationType="fade"
                                    onRequestClose={() => setEditProductSelectorVisible(false)}
                                >
                                    <View style={styles.productSelectorOverlay}>
                                        <View style={styles.productSelectorContent}>
                                            <View style={styles.productSelectorHeader}>
                                                <Text style={styles.productSelectorTitle}>Seleccionar Producto</Text>
                                                <TouchableOpacity onPress={() => setEditProductSelectorVisible(false)}>
                                                    <Text style={styles.productSelectorClose}>✕</Text>
                                                </TouchableOpacity>
                                            </View>

                                            <View style={styles.productSelectorSearch}>
                                                <SoftInput
                                                    containerStyle={styles.productSelectorSearchInput}
                                                    placeholder="Buscar producto..."
                                                    value={editProductSearch}
                                                    onChangeText={setEditProductSearch}
                                                />
                                            </View>

                                            <FlatList
                                                data={editProductSearch.trim()
                                                    ? editProducts.filter(p => p.name.toLowerCase().includes(editProductSearch.toLowerCase()))
                                                    : editProducts}
                                                keyExtractor={item => item.id.toString()}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={styles.productSelectorItem}
                                                        onPress={() => {
                                                            setEditSelectedProduct(item);
                                                            setEditProductSelectorVisible(false);
                                                            setEditProductSearch('');
                                                        }}
                                                    >
                                                        <Text style={styles.productSelectorItemName}>{item.name}</Text>
                                                        <Text style={styles.productSelectorItemPrice}>{formatCents(item.priceCents)}</Text>
                                                    </TouchableOpacity>
                                                )}
                                                ItemSeparatorComponent={() => <View style={styles.productSelectorSeparator} />}
                                                style={styles.productSelectorList}
                                                ListEmptyComponent={
                                                    <Text style={styles.productSelectorEmpty}>
                                                        {editProductSearch.trim() ? 'No se encontraron productos' : 'No hay productos disponibles'}
                                                    </Text>
                                                }
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            </View>
                        )}

                        {isEditMode && (
                            <View style={styles.actionButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.saveBtn, editErrors.size > 0 && styles.actionBtnDisabled]}
                                    onPress={handleSaveEdits}
                                    disabled={editErrors.size > 0}
                                >
                                    <Text style={styles.actionBtnText}>✓ Guardar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={handleEditModeToggle}>
                                    <Text style={styles.actionBtnText}>✕ Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 10 },
    card: { flex: 1, backgroundColor: '#FFF', marginHorizontal: 15, marginBottom: 15, borderRadius: 10, borderWidth: 1, borderColor: '#EEE', overflow: 'hidden' },
    filterSection: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    filterBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#F5F5F5', borderRadius: 8, alignItems: 'center' },
    activeFilter: { backgroundColor: '#EEF2FF', borderColor: theme.colors.primary, borderWidth: 1 },
    filterBtnText: { fontWeight: '600' },
    dateSelector: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#F5F5F5', borderRadius: 8 },
    dateSelectorText: { fontWeight: '600' },
    listContent: { paddingBottom: 20 },
    saleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    saleInfo: { flex: 1 },
    saleTime: { fontWeight: 'bold', fontSize: 16 },
    saleDate: { color: '#888', fontSize: 12 },
    saleSummary: { color: '#888', fontSize: 12, marginTop: 2 },
    saleTotal: { fontWeight: 'bold', color: theme.colors.primary, fontSize: 16 },
    separator: { height: 1, backgroundColor: '#EEE' },
    emptyText: { textAlign: 'center', color: '#888', padding: 40 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 12, maxHeight: '90%', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerBtn: { padding: 6, borderRadius: 6 },
    headerEditBtn: { backgroundColor: theme.colors.primary },
    headerDeleteBtn: { backgroundColor: '#FF5252' },
    headerBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    modalClose: { fontSize: 24, color: '#999', marginLeft: 5 },
    detailSummary: { padding: 15, backgroundColor: '#F9F9F9' },
    detailText: { fontSize: 14, color: '#666' },
    detailTotal: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary, marginTop: 5 },
    itemsList: { maxHeight: 400 },
    itemRow: { padding: 15 },
    itemNameCol: { flex: 1 },
    itemNameSnp: { fontWeight: 'bold', fontSize: 15 },
    itemPriceSnp: { color: '#888', fontSize: 12 },
    itemQtyCol: { alignItems: 'flex-end' },
    itemQtyText: { fontWeight: 'bold' },
    itemSubtotalSnp: { color: theme.colors.primary, fontWeight: 'bold' },
    editItemContainer: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10 },
    deletedItemContainer: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
    deletedOverlay: { alignItems: 'center', padding: 10 },
    deletedText: { color: '#C62828', fontWeight: 'bold', marginBottom: 5 },
    restoreBtn: { backgroundColor: '#E8F5E9', padding: 6, borderRadius: 4 },
    restoreBtnText: { color: '#2E7D32', fontSize: 12, fontWeight: 'bold' },
    editItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    deleteItemIconBtn: { padding: 5 },
    deleteItemIcon: { color: '#FF5252', fontSize: 18 },
    originalValuesRow: { flexDirection: 'row', gap: 15, marginBottom: 10 },
    originalValueText: { fontSize: 11, color: '#888' },
    originalValueBold: { fontWeight: 'bold', color: '#444' },
    editRow: { flexDirection: 'row', gap: 15 },
    editField: { flex: 1 },
    editLabel: { fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4 },
    qtyControlRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    qtyBtn: { width: 30, height: 30, backgroundColor: '#EEE', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { fontSize: 20, fontWeight: 'bold' },
    editInput: { borderBottomWidth: 1, borderBottomColor: theme.colors.primary, padding: 5, backgroundColor: '#F5F5F5', borderRadius: 4, textAlign: 'center' },
    editSubtotal: { marginTop: 10, alignItems: 'flex-end' },
    editSubtotalValue: { fontWeight: 'bold', color: theme.colors.primary, fontSize: 16 },
    actionButtonsContainer: { flexDirection: 'row', padding: 15, gap: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
    actionBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    actionBtnDisabled: { opacity: 0.55 },
    saveBtn: { backgroundColor: theme.colors.primary },
    cancelBtn: { backgroundColor: '#EEE' },
    actionBtnText: { fontWeight: 'bold', color: '#FFF' },
    inputError: { borderBottomColor: '#FF5252' },

    // Add Product Section
    addProductSection: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#EEE' },
    addProductSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#666', marginBottom: 8 },
    addProductSelector: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 8, borderWidth: 1.5, borderColor: '#DDD', marginBottom: 8,
    },
    addProductSelectorSelected: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1 },
    addProductSelectorPlaceholder: { fontSize: 14, color: '#999', flex: 1 },
    addProductSelectorArrow: { fontSize: 11, color: '#999', fontWeight: '600' },
    addProductRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    addProductQtyInput: { width: 75 },
    addProductBtn: { flex: 1, backgroundColor: theme.colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    addProductBtnDisabled: { opacity: 0.5 },
    addProductBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    // Product Selector Modal
    productSelectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    productSelectorContent: { backgroundColor: '#FFF', borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '80%', paddingBottom: 16 },
    productSelectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    productSelectorTitle: { fontSize: 16, fontWeight: 'bold' },
    productSelectorClose: { fontSize: 22, color: '#999' },
    productSelectorSearch: { marginHorizontal: 12, marginVertical: 10 },
    productSelectorSearchInput: { minHeight: 42 },
    productSelectorList: { maxHeight: 350 },
    productSelectorItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, marginHorizontal: 12 },
    productSelectorItemName: { fontSize: 14, flex: 1 },
    productSelectorItemPrice: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
    productSelectorSeparator: { height: 1, backgroundColor: '#EEE', marginHorizontal: 12 },
    productSelectorEmpty: { textAlign: 'center', color: '#999', padding: 24, fontSize: 13 },
});
