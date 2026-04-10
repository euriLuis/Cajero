import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { productsRepo } from '../../../data/repositories';
import { Product } from '../../../shared/domain/models/Product';
import { parseMoneyToCents } from '../../../shared/utils/money';
import { useSoftNotice } from '../../../ui/components';

export function useProductsScreen() {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formName, setFormName] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const { showNotice } = useSoftNotice();

    const loadProducts = useCallback(async (searchTerm: string) => {
        setLoading(true);
        try {
            const list = await productsRepo.listActiveProducts(searchTerm);
            setProducts(list);
        } catch {
            showNotice({ title: 'Error', message: 'No se pudieron cargar los productos', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [showNotice]);

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
        if (!formName.trim()) {
            showNotice({ title: 'Error', message: 'El nombre es requerido', type: 'error' });
            return;
        }
        const priceCents = parseMoneyToCents(formPrice);

        try {
            if (editingProduct) await productsRepo.updateProduct(editingProduct.id, { name: formName, priceCents });
            else await productsRepo.createProduct(formName, priceCents);

            setModalVisible(false);
            loadProducts(search);
        } catch {
            showNotice({ title: 'Error', message: 'No se pudo guardar el producto', type: 'error' });
        }
    }, [editingProduct, formName, formPrice, search, loadProducts, showNotice]);

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
                        showNotice({ title: 'Error', message: 'No se pudo desactivar', type: 'error' });
                    }
                },
            },
        ]);
    }, [editingProduct, search, loadProducts, showNotice]);

    const handleRefresh = useCallback(() => loadProducts(search), [search, loadProducts]);

    return {
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
    };
}
