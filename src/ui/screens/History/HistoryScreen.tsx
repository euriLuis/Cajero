import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert } from 'react-native';
import { salesRepo } from '../../../data/repositories';
import { Sale } from '../../../domain/models/Sale';
import { SaleItem } from '../../../domain/models/SaleItem';
import { formatCents, parseMoneyToCents } from '../../../utils/money';
import { getDayRangeMs, formatDateShort, formatTimeNoSeconds, formatDateTimeWithSeconds } from '../../../utils/dates';
import { theme } from '../../theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
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
    draft: { qty: string; price: string; deleted?: boolean };
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
    const [editedItems, setEditedItems] = useState<Map<number, { qty: string; price: string; deleted?: boolean }>>(new Map());
    const [editErrors, setEditErrors] = useState<Map<number, string>>(new Map());

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
        } else {
            if (saleItems.length === 0) {
                showNotice({ title: 'Error', message: 'No hay productos para editar', type: 'error' });
                return;
            }
            const initialDraft = new Map<number, { qty: string; price: string; deleted?: boolean }>();
            for (const item of saleItems) {
                initialDraft.set(item.id, { qty: '', price: '' });
            }
            setEditedItems(initialDraft);
            setEditErrors(new Map());
            setIsEditMode(true);
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
                else if (draft.qty !== '' || draft.price !== '') {
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
        <View style={styles.container}>

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
    container: { flex: 1, backgroundColor: theme.colors.background },
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
});
