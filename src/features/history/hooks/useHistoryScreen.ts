import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from 'react-native';
import { salesRepo, productsRepo } from '../../../data/repositories';
import { Sale } from '../../../shared/domain/models/Sale';
import { SaleItem } from '../../../shared/domain/models/SaleItem';
import { Product } from '../../../shared/domain/models/Product';
import { getDayRangeMs } from '../../../shared/utils/dates';
import { parseMoneyToCents } from '../../../shared/utils/money';
import { useSoftNotice } from '../../../ui/components';
import { isToday, isYesterday } from '../../shared/utils/dateComparisons';
import { validateQuantity, validateEditPrice, resolveDraftQty, resolveDraftPrice } from '../../shared/utils/validation';

export type EditDraft = {
    qty: string;
    price: string;
    deleted?: boolean;
    _newItem?: boolean;
    _productId?: number;
    _productNameSnapshot?: string;
    _unitPriceSnapshotCents?: number;
};

export function useHistoryScreen() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editedItems, setEditedItems] = useState<Map<number, EditDraft>>(new Map());
    const [editErrors, setEditErrors] = useState<Map<number, string>>(new Map());

    const [editProducts, setEditProducts] = useState<Product[]>([]);
    const [editProductSelectorVisible, setEditProductSelectorVisible] = useState(false);
    const [editSelectedProduct, setEditSelectedProduct] = useState<Product | null>(null);
    const [editAddQty, setEditAddQty] = useState('1');
    const [editProductSearch, setEditProductSearch] = useState('');

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
        } catch {
            showNotice({ title: 'Error', message: 'No se pudieron cargar las ventas', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [currentDate, showNotice]);

    useFocusEffect(useCallback(() => {
        loadSales();
    }, [loadSales]));

    const handleQuickDate = useCallback((type: 'today' | 'yesterday') => {
        const newDate = new Date();
        if (type === 'yesterday') newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    }, []);

    const onPickerChange = useCallback((event: any, selectedDate?: Date) => {
        setShowPicker(false);
        if (selectedDate) setCurrentDate(selectedDate);
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
            productsRepo.listActiveProducts().then(setEditProducts).catch(() => { });
        }
    }, [isEditMode, saleItems, showNotice]);

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
        const qtyValidation = validateQuantity(editAddQty);
        if (!qtyValidation.valid) {
            showNotice({ title: 'Error', message: qtyValidation.error, type: 'error' });
            return;
        }
        const qty = qtyValidation.value;

        const existing = saleItems.find(si => si.productId === editSelectedProduct.id);
        if (existing) {
            const draft = editedItems.get(existing.id) ?? { qty: '', price: '' };
            const currentQty = draft.qty !== '' ? parseInt(draft.qty || '0') || existing.qty : existing.qty;
            handleItemQtyChange(existing.id, (currentQty + qty).toString());
        } else {
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
    }, [editSelectedProduct, editAddQty, saleItems, editedItems, handleItemQtyChange, showNotice]);

    const handleQtyIncrement = useCallback((itemId: number) => {
        const item = saleItems.find(i => i.id === itemId);
        if (!item) return;
        const draft = editedItems.get(itemId) ?? { qty: '', price: '' };
        const currentQty = resolveDraftQty(draft.qty, item.qty);
        handleItemQtyChange(itemId, (currentQty + 1).toString());
    }, [saleItems, editedItems, handleItemQtyChange]);

    const handleQtyDecrement = useCallback((itemId: number) => {
        const item = saleItems.find(i => i.id === itemId);
        if (!item) return;
        const draft = editedItems.get(itemId) ?? { qty: '', price: '' };
        const currentQty = resolveDraftQty(draft.qty, item.qty);
        if (currentQty > 1) handleItemQtyChange(itemId, (currentQty - 1).toString());
    }, [saleItems, editedItems, handleItemQtyChange]);

    const editedTotalMain = useMemo(() => {
        let total = 0;
        for (const item of saleItems) {
            const draft = editedItems.get(item.id) ?? { qty: '', price: '' };
            if (draft.deleted) continue;
            const qty = resolveDraftQty(draft.qty, item.qty);
            const price = resolveDraftPrice(draft.price, item.unitPriceSnapshotCents, parseMoneyToCents);
            total += qty * price;
        }
        for (const [key, draft] of editedItems) {
            if (key < 0 && (draft as any)._newItem) {
                if (draft.deleted) continue;
                const qty = parseInt(draft.qty, 10) || 0;
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
        } catch {
            showNotice({ title: 'Error', message: 'No se pudieron guardar los cambios', type: 'error' });
        }
    }, [editErrors, selectedSale, editedItems, saleItems, loadSales, showNotice]);

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
                    } catch {
                        showNotice({ title: 'Error', message: 'No se pudo eliminar', type: 'error' });
                    }
                }
            }
        ]);
    }, [selectedSale, loadSales, showNotice]);

    const handleOpenDetail = useCallback(async (sale: Sale) => {
        try {
            const items = await salesRepo.getSaleItems(sale.id);
            setSaleItems(items);
            setSelectedSale(sale);
            setIsEditMode(false);
            setEditedItems(new Map());
            setDetailModalVisible(true);
        } catch {
            showNotice({ title: 'Error', message: 'No se pudieron traer los detalles', type: 'error' });
        }
    }, [showNotice]);

    const handleRefresh = useCallback(() => loadSales(), [loadSales]);

    const currentDateMs = currentDate.getTime();
    const todayFlag = isToday(currentDateMs);
    const yesterdayFlag = isYesterday(currentDateMs);

    return {
        sales,
        loading,
        currentDate,
        showPicker,
        setShowPicker,
        selectedSale,
        saleItems,
        detailModalVisible,
        setDetailModalVisible,
        isEditMode,
        editedItems,
        editErrors,
        editProducts,
        editProductSelectorVisible,
        setEditProductSelectorVisible,
        editSelectedProduct,
        setEditSelectedProduct,
        editAddQty,
        setEditAddQty,
        editProductSearch,
        setEditProductSearch,
        itemsSummaryBySaleId,
        editedTotalMain,
        todayFlag,
        yesterdayFlag,
        handleQuickDate,
        onPickerChange,
        handleEditModeToggle,
        handleItemQtyChange,
        handleItemPriceChange,
        handleDeleteItem,
        handleRestoreItem,
        handleAddProductToSale,
        handleQtyIncrement,
        handleQtyDecrement,
        handleSaveEdits,
        handleDeleteSale,
        handleOpenDetail,
        handleRefresh,
    };
}
