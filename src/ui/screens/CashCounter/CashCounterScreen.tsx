import React, { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppScreen, Card, AppButton } from '../../components';
import { theme, radius } from '../../theme';
import { formatCents } from '../../../utils/money';
import { cashRepo, salesRepo, withdrawalsRepo } from '../../../data/repositories';
import { getDayRangeMs, formatDateTimeWithSeconds, formatTimeNoSeconds, formatDateShort } from '../../../utils/dates';
import { CashMovement, CashState } from '../../../data/repositories/cashRepo';

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5];

type QuantitiesState = Record<string, string>;


type MovementListRow =
    | { type: 'day'; key: string; dayLabel: string }
    | { type: 'movement'; key: string; movement: CashMovement };

// 2) Optimized Row Components
const MovementRow = memo(({
    item,
    onPress,
    deletingId
}: {
    item: CashMovement;
    onPress: (item: CashMovement) => void;
    deletingId: number | null
}) => {
    if (item.id === deletingId) return null;

    return (
        <TouchableOpacity style={styles.movRow} onPress={() => onPress(item)}>
            <View style={styles.movTimeCol}>
                <View style={[styles.tag, item.type === 'IN' ? styles.tagPositive : styles.tagNegative]}>
                    <Text style={styles.tagTextSmall}>{item.type === 'IN' ? 'DEPÓSITO' : 'EXTRACCIÓN'}</Text>
                </View>
                <Text style={styles.movTimeText}>{formatTimeNoSeconds(new Date(item.created_at).getTime())}</Text>
            </View>
            <View style={styles.movDescCol}>
                <Text style={styles.movDescText} numberOfLines={1}>
                    {item.note || 'Movimiento de caja'}
                </Text>
            </View>
            <View style={styles.movAmountCol}>
                <Text style={[styles.movAmountText, item.type === 'IN' ? styles.positive : styles.negative]}>
                    {item.type === 'IN' ? '+' : '-'}{formatCents(item.total_cents)}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

const TableRow = memo(({
    denom,
    idx,
    value,
    onChangeText,
    onSubmitEditing,
    inputRef,
    isLast
}: {
    denom: number;
    idx: number;
    value: string;
    onChangeText: (text: string) => void;
    onSubmitEditing: () => void;
    inputRef: (ref: TextInput | null) => void;
    isLast: boolean;
}) => {
    const subtotal = useMemo(() => {
        const qty = parseInt(value || '0', 10);
        return (denom * 100) * qty;
    }, [denom, value]);

    return (
        <View style={[styles.tableRow, isLast && styles.noBorder]}>
            <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '600' }]}>${denom}</Text>
            <View style={{ flex: 1, alignItems: 'center' }}>
                <TextInput
                    ref={inputRef}
                    style={styles.tableInput}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="number-pad"
                    placeholder="0"
                    selectTextOnFocus
                    onSubmitEditing={onSubmitEditing}
                    returnKeyType={isLast ? 'done' : 'next'}
                />
            </View>
            <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', color: theme.colors.primary, fontWeight: '700' }]}>
                {formatCents(subtotal)}
            </Text>
        </View>
    );
});

const StoredGridItem = memo(({ d, qty }: { d: number; qty: number }) => (
    <View style={styles.storedGridItemWrapper}>
        <Text style={styles.storedDenomHeader}>${d}</Text>
        <View style={styles.storedGridItem}>
            <View style={styles.storedGridQtyBox}>
                <Text style={styles.storedGridQty}>x{qty}</Text>
            </View>
            <Text style={styles.storedGridSub}>
                {formatCents(d * 100 * qty)}
            </Text>
        </View>
    </View>
));

const BalanceComparisonCard = memo(({
    title,
    expectedLabel,
    expectedValue,
    actualLabel,
    actualValue,
    diffValue,
    accentColor,
}: {
    title: string;
    expectedLabel: string;
    expectedValue: number;
    actualLabel: string;
    actualValue: number;
    diffValue: number;
    accentColor: string;
}) => {
    const diffStatus = diffValue > 0 ? 'SOBRA' : diffValue < 0 ? 'FALTA' : 'OK';
    const diffStyle = diffValue > 0 ? styles.positive : diffValue < 0 ? styles.negative : styles.neutral;
    const tagStyle = diffValue > 0 ? styles.tagPositive : diffValue < 0 ? styles.tagNegative : styles.tagNeutral;

    return (
        <Card style={[styles.summaryCard, { borderLeftColor: accentColor }]}>
            <Text style={styles.balanceTitle}>{title}</Text>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{expectedLabel}</Text>
                <Text style={styles.summaryValue}>{formatCents(expectedValue)}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{actualLabel}</Text>
                <Text style={styles.summaryValue}>{formatCents(actualValue)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.diffBorder]}>
                <Text style={styles.summaryLabelBold}>Diferencia:</Text>
                <View style={styles.diffContainer}>
                    <Text style={[styles.diffText, diffStyle]}>{formatCents(diffValue)}</Text>
                    <View style={[styles.tag, tagStyle]}>
                        <Text style={styles.tagText}>{diffStatus}</Text>
                    </View>
                </View>
            </View>
        </Card>
    );
});

export const CashCounterScreen = () => {
    const [quantities, setQuantities] = useState<QuantitiesState>({});
    const [cashState, setCashState] = useState<CashState | null>(null);
    const [movements, setMovements] = useState<CashMovement[]>([]);
    const [totalSalesToday, setTotalSalesToday] = useState<number>(0);
    const [salesTabTotal, setSalesTabTotal] = useState<number>(0);
    const [totalWithdrawalsToday, setTotalWithdrawalsToday] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Deletion states
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Modal states
    const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    const inputRefs = useRef<Record<number, TextInput | null>>({});
    const initialLoadDone = useRef(false);

    const loadData = useCallback(async (isRefresh = false) => {
        if (!isRefresh && !initialLoadDone.current) setLoading(true);
        else setRefreshing(true);

        try {
            const [draft, state, movs, salesDraftTotal, { startMs, endMs }] = await Promise.all([
                cashRepo.getCashCounterDraft(),
                cashRepo.getCashState(),
                cashRepo.listCashMovements(20),
                salesRepo.getCurrentSaleDraftTotal(),
                getDayRangeMs(new Date())
            ]);

            const initial: QuantitiesState = {};
            DENOMS.forEach(d => {
                initial[d.toString()] = draft[d.toString()] || '';
            });

            setQuantities(initial);
            setCashState(state);
            setMovements(movs);
            setSalesTabTotal(salesDraftTotal);

            const [salesSum, withdrawalsSum] = await Promise.all([
                salesRepo.sumSalesByRange(startMs, endMs),
                withdrawalsRepo.sumWithdrawalsByRange(startMs, endMs)
            ]);

            setTotalSalesToday(salesSum);
            setTotalWithdrawalsToday(withdrawalsSum);
            initialLoadDone.current = true;
        } catch (error) {
            console.error('Error loading cash data:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos de caja');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            };
        }, [loadData])
    );

    // 1) Debounced Save to persist only when idle
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            cashRepo.setCashCounterDraft(quantities);
        }, 500); // Increased debounce to 500ms

        return () => clearTimeout(timer);
    }, [quantities]);

    const handleQuantityChange = useCallback((denom: number, text: string) => {
        setQuantities(prev => ({
            ...prev,
            [denom.toString()]: text,
        }));
    }, []);

    const handleNextInput = useCallback((index: number) => {
        if (index < DENOMS.length - 1) {
            const nextDenom = DENOMS[index + 1];
            inputRefs.current[nextDenom]?.focus();
        }
    }, []);

    const handleResetDraft = useCallback(() => {
        Alert.alert('Resetear Contador', '¿Poner a cero el conteo actual? El saldo guardado no cambiará.', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Resetear',
                style: 'destructive',
                onPress: () => {
                    const reset: QuantitiesState = {};
                    DENOMS.forEach(d => (reset[d.toString()] = ''));
                    setQuantities(reset);
                    cashRepo.setCashCounterDraft(reset);
                },
            },
        ]);
    }, []);

    const totalContadoCents = useMemo(() => {
        return DENOMS.reduce((sum, denom) => {
            const qtyStr = quantities[denom.toString()] || '';
            const qty = parseInt(qtyStr || '0', 10);
            return sum + (denom * 100 * qty);
        }, 0);
    }, [quantities]);

    // Comparisons
    const diffConteoVsVentas = useMemo(() => totalContadoCents - salesTabTotal, [totalContadoCents, salesTabTotal]);

    const totalStoredCents = useMemo(() => {
        if (!cashState) return 0;
        return DENOMS.reduce((sum, d) => sum + (d * 100 * (cashState.denoms[d.toString()] || 0)), 0);
    }, [cashState]);

    const expectedCashSummary = useMemo(() => totalSalesToday - totalWithdrawalsToday, [totalSalesToday, totalWithdrawalsToday]);
    const diffStoredVsSummary = useMemo(() => totalStoredCents - expectedCashSummary, [totalStoredCents, expectedCashSummary]);

    const handleApplyMovement = useCallback(async (type: 'IN' | 'OUT') => {
        if (totalContadoCents === 0) {
            Alert.alert('Conteo vacío', 'Ingresa cantidades antes de aplicar un movimiento.');
            return;
        }

        const denomsDelta: Record<string, number> = {};
        DENOMS.forEach(d => {
            const qty = parseInt(quantities[d.toString()] || '0', 10);
            if (qty > 0) denomsDelta[d.toString()] = qty;
        });

        const actionText = type === 'IN' ? 'AGREGAR' : 'RESTAR';
        Alert.alert(
            `¿${actionText} saldo?`,
            `Se aplicará un total de ${formatCents(totalContadoCents)} al saldo de caja.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        try {
                            await cashRepo.applyMovement(type, denomsDelta);

                            const reset: QuantitiesState = {};
                            DENOMS.forEach(d => (reset[d.toString()] = ''));

                            await cashRepo.setCashCounterDraft(reset);
                            setQuantities(reset);

                            await loadData(true);
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    }, [totalContadoCents, quantities, loadData]);

    const handleDeleteMovement = useCallback(() => {
        if (!selectedMovement) return;
        const idToDelete = selectedMovement.id;

        setDetailModalVisible(false);
        setDeletingId(idToDelete);

        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

        undoTimerRef.current = setTimeout(async () => {
            try {
                await cashRepo.deleteCashMovement(idToDelete);
                setDeletingId(null);
                await loadData(true);
            } catch (error: any) {
                Alert.alert('Error', error.message || 'No se pudo eliminar el movimiento');
                setDeletingId(null);
            }
        }, 4000);
    }, [selectedMovement, loadData]);

    const handleUndoDelete = useCallback(() => {
        if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setDeletingId(null);
    }, []);

    const handleOpenDetail = useCallback((mov: CashMovement) => {
        setSelectedMovement(mov);
        setDetailModalVisible(true);
    }, []);

    const movementRows = useMemo<MovementListRow[]>(() => {
        const rows: MovementListRow[] = [];
        let lastDay = '';

        for (const movement of movements) {
            const dayLabel = formatDateShort(new Date(movement.created_at).getTime());
            if (dayLabel !== lastDay) {
                rows.push({
                    type: 'day',
                    key: `day-${dayLabel}-${movement.id}`,
                    dayLabel,
                });
                lastDay = dayLabel;
            }

            rows.push({
                type: 'movement',
                key: `mov-${movement.id}`,
                movement,
            });
        }

        return rows;
    }, [movements]);

    const renderMovement = useCallback(({ item }: { item: MovementListRow }) => {
        if (item.type === 'day') {
            return (
                <View style={styles.dayHeader}>
                    <Text style={styles.dayHeaderText}>{item.dayLabel}</Text>
                </View>
            );
        }

        return (
            <MovementRow
                item={item.movement}
                onPress={handleOpenDetail}
                deletingId={deletingId}
            />
        );
    }, [handleOpenDetail, deletingId]);

    const HeaderComponent = useMemo(() => (
        <View style={styles.headerContainer}>
            {/* Top Comparison: Conteo Actual vs Total Ventas */}
            <BalanceComparisonCard
                title="Balance esperado (Conteo actual ↔ Ventas)"
                expectedLabel="Total pestaña Ventas (Esperado):"
                expectedValue={salesTabTotal}
                actualLabel="Total contado:"
                actualValue={totalContadoCents}
                diffValue={diffConteoVsVentas}
                accentColor={theme.colors.primary}
            />

            {/* Current Counter UI */}
            <View style={[styles.sectionTitleRow, styles.sectionTitleRowCompactTop]}>
                <Text style={styles.sectionTitle}>Conteo Actual</Text>
                <Text style={styles.totalDraftBig}>{formatCents(totalContadoCents)}</Text>
            </View>

            <Card variant="elevated" style={styles.tableCard}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHCell, { flex: 1.5 }]}>Denom.</Text>
                    <Text style={[styles.tableHCell, { flex: 1, textAlign: 'center' }]}>Cantidad</Text>
                    <Text style={[styles.tableHCell, { flex: 1.5, textAlign: 'right' }]}>Subtotal</Text>
                </View>
                {DENOMS.map((denom, idx) => (
                    <TableRow
                        key={`d-${denom}`}
                        denom={denom}
                        idx={idx}
                        value={quantities[denom.toString()] || ''}
                        onChangeText={(text) => handleQuantityChange(denom, text)}
                        onSubmitEditing={() => handleNextInput(idx)}
                        inputRef={(ref) => { if (ref) inputRefs.current[denom] = ref; }}
                        isLast={idx === DENOMS.length - 1}
                    />
                ))}
            </Card>

            {/* Counter Buttons */}
            <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.btnAction, styles.btnIn]} onPress={() => handleApplyMovement('IN')}>
                    <Text style={styles.btnActionText}>AGREGAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnAction, styles.btnOut]} onPress={() => handleApplyMovement('OUT')}>
                    <Text style={styles.btnActionText}>RESTAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnAction, styles.btnReset]} onPress={handleResetDraft}>
                    <Text style={styles.btnActionText}>RESET</Text>
                </TouchableOpacity>
            </View>

            {/* Stored Cash Comparison vs Summary Caja */}
            <BalanceComparisonCard
                title="Balance esperado (Caja guardada ↔ Resumen)"
                expectedLabel="Caja Resumen (Esperado):"
                expectedValue={expectedCashSummary}
                actualLabel="Total en Caja Guardado:"
                actualValue={totalStoredCents}
                diffValue={diffStoredVsSummary}
                accentColor="#10B981"
            />

            {/* Stored Balance Detail */}
            <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Caja (Saldo Guardado)</Text>
                <Text style={styles.totalStoredText}>{formatCents(totalStoredCents)}</Text>
            </View>

            <Card variant="outlined" style={styles.storedBalanceContainer}>
                <View style={styles.storedGrid}>
                    {DENOMS.map(d => (
                        <StoredGridItem
                            key={`s-${d}`}
                            d={d}
                            qty={cashState?.denoms[d.toString()] || 0}
                        />
                    ))}
                </View>
            </Card>

            {/* Section Title: History */}
            <View style={[styles.sectionTitleRow, { marginBottom: 10, marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
            </View>
        </View>
    ), [
        totalSalesToday,
        totalContadoCents,
        diffConteoVsVentas,
        quantities,
        handleQuantityChange,
        handleNextInput,
        handleResetDraft,
        handleApplyMovement,
        expectedCashSummary,
        totalStoredCents,
        diffStoredVsSummary,
        cashState
    ]);

    if (loading && !refreshing) {
        return (
            <AppScreen>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </AppScreen>
        );
    }

    return (
        <AppScreen>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                {/* 3) Optimized FlatList */}
                <FlatList
                    data={movementRows}
                    keyExtractor={item => item.key}
                    renderItem={renderMovement}
                    ListHeaderComponent={HeaderComponent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay movimientos registrados</Text>}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={() => loadData(true)}

                    // Perf Props
                    removeClippedSubviews={true}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    windowSize={5}
                />

                {/* Undo Toast */}
                {deletingId !== null && (
                    <View style={styles.undoContainer}>
                        <Text style={styles.undoText}>Movimiento eliminado</Text>
                        <TouchableOpacity onPress={handleUndoDelete}>
                            <Text style={styles.undoAction}>DESHACER</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Movement Detail Modal */}
                <Modal visible={detailModalVisible} transparent animationType="fade" onRequestClose={() => setDetailModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Detalle de Movimiento</Text>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                    <Text style={styles.modalClose}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            {selectedMovement && (
                                <View style={styles.modalBody}>
                                    <View style={styles.modalInfoRow}>
                                        <Text style={styles.modalLabel}>Fecha y Hora:</Text>
                                        <Text style={styles.modalValue}>{formatDateTimeWithSeconds(new Date(selectedMovement.created_at).getTime())}</Text>
                                    </View>
                                    <View style={styles.modalInfoRow}>
                                        <Text style={styles.modalLabel}>Tipo:</Text>
                                        <View style={[styles.tag, selectedMovement.type === 'IN' ? styles.tagPositive : styles.tagNegative]}>
                                            <Text style={styles.tagText}>{selectedMovement.type === 'IN' ? 'DEPÓSITO' : 'EXTRACCIÓN'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.modalInfoRow}>
                                        <Text style={styles.modalLabel}>Total:</Text>
                                        <Text style={[styles.modalValueBig, selectedMovement.type === 'IN' ? styles.positive : styles.negative]}>
                                            {formatCents(selectedMovement.total_cents)}
                                        </Text>
                                    </View>

                                    <View style={styles.modalDivider} />
                                    <Text style={styles.modalSubTitle}>Desglose aplicado:</Text>

                                    <View style={styles.modalDenomGrid}>
                                        {Object.entries(JSON.parse(selectedMovement.denominations_json)).map(([d, q]) => (
                                            <View key={`mod-d-${d}`} style={styles.modalDenomRow}>
                                                <Text style={styles.modalDenomLabel}>${d} x {String(q)}</Text>
                                                <Text style={styles.modalDenomValue}>{formatCents(parseInt(d) * 100 * (Number(q) || 0))}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.btnDelete} onPress={handleDeleteMovement}>
                                    <Text style={styles.btnDeleteText}>Eliminar Movimiento</Text>
                                </TouchableOpacity>
                                <AppButton label="Cerrar" onPress={() => setDetailModalVisible(false)} variant="secondary" />
                            </View>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </AppScreen>
    );
};

const styles = StyleSheet.create({
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: theme.spacing.md, paddingBottom: 100 },
    headerContainer: { marginBottom: 10 },

    // Top Summary
    summaryCard: { padding: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: theme.colors.primary },
    balanceTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    summaryLabel: { fontSize: 12, color: theme.colors.mutedText },
    summaryValue: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
    summaryLabelBold: { fontSize: 13, fontWeight: 'bold', color: theme.colors.text },
    diffBorder: { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.border },
    diffContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    diffText: { fontSize: 14, fontWeight: 'bold' },

    // Sections
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
    sectionTitleRowCompactTop: { marginTop: 5 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
    totalDraftBig: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
    totalStoredText: { fontSize: 18, fontWeight: '700', color: theme.colors.text },

    // Table
    tableCard: { padding: 0, overflow: 'hidden', marginBottom: 10 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F0F2F5', padding: 6 },
    tableHCell: { fontSize: 11, fontWeight: 'bold', color: theme.colors.mutedText },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    noBorder: { borderBottomWidth: 0 },
    tableCell: { fontSize: 14, color: theme.colors.text },
    tableInput: {
        width: 66, height: 26, borderWidth: 1.5, borderColor: theme.colors.primary,
        borderRadius: radius.md, textAlign: 'center', fontSize: 13, fontWeight: 'bold',
        backgroundColor: '#FFF', paddingVertical: 0
    },

    // Buttons
    buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    btnAction: { flex: 1, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
    btnIn: { backgroundColor: theme.colors.primary },
    btnOut: { backgroundColor: '#C62828' },
    btnReset: { backgroundColor: '#757575' },
    btnActionText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

    // Stored Balance New Layout
    storedBalanceContainer: {
        padding: 12,
        marginTop: 4,
        backgroundColor: '#F8F9FA'
    },
    storedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
    storedGridItemWrapper: {
        width: '31%', marginBottom: 8, alignItems: 'center'
    },
    storedDenomHeader: { fontSize: 15, fontWeight: '900', color: theme.colors.text, marginBottom: 2 },
    storedGridItem: {
        width: '100%', backgroundColor: '#FFF', padding: 4, borderRadius: radius.md,
        borderWidth: 1, borderColor: '#DDD', alignItems: 'center'
    },
    storedGridQtyBox: { backgroundColor: '#E8EAF6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 2 },
    storedGridQty: { fontSize: 12, fontWeight: 'bold', color: theme.colors.primary },
    storedGridSub: { fontSize: 11, color: '#666', fontWeight: '600' },

    // History List
    movRow: {
        flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF',
        borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border
    },
    movTimeCol: { width: 70, alignItems: 'center' },
    movTimeText: { fontSize: 11, color: theme.colors.mutedText, marginTop: 4 },
    movDescCol: { flex: 1, paddingHorizontal: 10 },
    movDescText: { fontSize: 13, color: theme.colors.text },
    movAmountCol: { alignItems: 'flex-end' },
    movAmountText: { fontSize: 14, fontWeight: 'bold' },
    dayHeader: { paddingVertical: 8, paddingHorizontal: 4 },
    dayHeaderText: { fontSize: 12, fontWeight: '700', color: theme.colors.mutedText, textTransform: 'uppercase' },

    // Undo Toast
    undoContainer: {
        position: 'absolute', bottom: 30, left: 20, right: 20,
        backgroundColor: '#333', padding: 15, borderRadius: 8,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6
    },
    undoText: { color: '#FFF', fontWeight: 'bold' },
    undoAction: { color: '#80CBC4', fontWeight: 'bold', fontSize: 14 },

    // Tags & Colors
    tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, minWidth: 40, alignItems: 'center' },
    tagPositive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32', borderWidth: 1 },
    tagNegative: { backgroundColor: '#FFEBEE', borderColor: '#C62828', borderWidth: 1 },
    tagNeutral: { backgroundColor: '#F5F5F5' },
    tagText: { fontSize: 10, fontWeight: 'bold', color: '#444' },
    tagTextSmall: { fontSize: 8, fontWeight: '900', color: '#444' },
    positive: { color: '#2E7D32' },
    negative: { color: '#C62828' },
    neutral: { color: theme.colors.text },
    emptyText: { textAlign: 'center', color: theme.colors.mutedText, padding: 30 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: radius.lg, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalClose: { fontSize: 22, color: '#999' },
    modalBody: { marginBottom: 20 },
    modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalLabel: { fontSize: 14, color: theme.colors.mutedText },
    modalValue: { fontSize: 14, fontWeight: '600' },
    modalValueBig: { fontSize: 24, fontWeight: '900' },
    modalDivider: { height: 1, backgroundColor: '#EEE', marginVertical: 15 },
    modalSubTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
    modalDenomGrid: { gap: 8 },
    modalDenomRow: { flexDirection: 'row', justifyContent: 'space-between' },
    modalDenomLabel: { fontSize: 14, color: theme.colors.text },
    modalDenomValue: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
    modalActions: { gap: 10 },
    btnDelete: { backgroundColor: '#FFEBEE', padding: 12, borderRadius: radius.md, alignItems: 'center', marginBottom: 8 },
    btnDeleteText: { color: '#C62828', fontWeight: 'bold' }
});
