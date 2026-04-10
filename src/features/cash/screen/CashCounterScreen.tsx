import React, { useCallback, useMemo, memo } from 'react';
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
import { AppScreen, AppButton, SoftCard, SoftButton, SoftInput, useSoftNotice } from '../../../ui/components';
import { theme, radius } from '../../../ui/theme';
import { formatCents } from '../../../shared/utils/money';
import { getDayRangeMs, formatDateTimeWithSeconds, formatTimeNoSeconds, formatDateShort } from '../../../shared/utils/dates';
import { useCashCounterScreen } from '../hooks/useCashCounterScreen';
import { CashMovement } from '../../../data/repositories/cashRepo';
import { DEFAULT_DENOMS } from '../utils/cashCalculations';

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
                <SoftInput
                    ref={inputRef}
                    containerStyle={styles.tableInput}
                    inputStyle={styles.tableInputText}
                    size="compact"
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
    okText,
    surplusText,
    deficitText,
}: {
    title: string;
    expectedLabel: string;
    expectedValue: number;
    actualLabel: string;
    actualValue: number;
    diffValue: number;
    accentColor: string;
    okText?: string;
    surplusText?: string;
    deficitText?: string;
}) => {
    const diffStatus = diffValue > 0 ? (surplusText || 'SOBRA') : diffValue < 0 ? (deficitText || 'FALTA') : (okText || 'OK');
    const diffStyle = diffValue > 0 ? styles.positive : diffValue < 0 ? styles.negative : styles.neutral;
    const tagStyle = diffValue > 0 ? styles.tagPositive : diffValue < 0 ? styles.tagNegative : styles.tagNeutral;

    return (
        <SoftCard style={[styles.summaryCard, { borderLeftColor: accentColor }]}>
            <Text style={styles.balanceTitle}>{title}</Text>
            <View style={styles.summaryRow}>
                <Text style={styles.expectedBalanceText}>{expectedLabel}</Text>
                <Text style={styles.expectedBalanceValue}>{formatCents(expectedValue)}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{actualLabel}</Text>
                <Text style={styles.summaryValue}>{formatCents(actualValue)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.diffBorder]}>
                <View style={styles.diffContainer}>
                    <View style={[styles.tag, tagStyle]}>
                        <Text style={styles.tagText}>{diffStatus}</Text>
                    </View>
                    {diffValue !== 0 && <Text style={[styles.diffText, diffStyle]}>{formatCents(Math.abs(diffValue))}</Text>}
                </View>
            </View>
        </SoftCard>
    );
});

export const CashCounterScreen = () => {
    const {
        quantities,
        cashState,
        movements,
        totalSalesToday,
        salesTabTotal,
        totalWithdrawalsToday,
        loading,
        refreshing,
        deletingId,
        selectedMovement,
        detailModalVisible,
        setDetailModalVisible,
        inputRefs,
        DENOMS,
        totalContadoCents,
        diffConteoVsVentas,
        totalStoredCents,
        expectedCashSummary,
        diffStoredVsSummary,
        movementRows,
        handleQuantityChange,
        handleNextInput,
        handleResetDraft,
        handleApplyMovement,
        handleDeleteMovement,
        handleUndoDelete,
        handleOpenDetail,
        handleRefresh,
    } = useCashCounterScreen();

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
            {salesTabTotal > 0 && (
                <BalanceComparisonCard
                    title="Balance esperado (Ventas)"
                    expectedLabel="Total ventas:"
                    expectedValue={salesTabTotal}
                    actualLabel="Total contado:"
                    actualValue={totalContadoCents}
                    diffValue={diffConteoVsVentas}
                    accentColor={theme.colors.primary}
                    okText="Cuadra con Ventas"
                />
            )}

            <View style={[styles.sectionTitleRow, styles.sectionTitleRowCompactTop]}>
                <Text style={styles.sectionTitle}>Conteo Actual</Text>
                <Text style={styles.totalDraftBig}>{formatCents(totalContadoCents)}</Text>
            </View>

            <SoftCard style={styles.tableCard}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHCell, { flex: 1.5 }]}>Denom.</Text>
                    <Text style={[styles.tableHCell, { flex: 1, textAlign: 'center' }]}>Cantidad</Text>
                    <Text style={[styles.tableHCell, { flex: 1.5, textAlign: 'right' }]}>Subtotal</Text>
                </View>
                {DEFAULT_DENOMS.map((denom: number, idx: number) => (
                    <TableRow
                        key={`d-${denom}`}
                        denom={denom}
                        idx={idx}
                        value={quantities[denom.toString()] || ''}
                        onChangeText={(text) => handleQuantityChange(denom, text)}
                        onSubmitEditing={() => handleNextInput(idx)}
                        inputRef={(ref) => { if (ref) inputRefs.current[denom] = ref; }}
                        isLast={idx === DEFAULT_DENOMS.length - 1}
                    />
                ))}
            </SoftCard>

            <View style={styles.buttonRow}>
                <SoftButton label="AGREGAR" onPress={() => handleApplyMovement('IN')} style={styles.btnAction} />
                <SoftButton label="RESTAR" variant="danger" onPress={() => handleApplyMovement('OUT')} style={styles.btnAction} />
                <SoftButton label="RESET" variant="ghost" onPress={handleResetDraft} style={styles.btnAction} />
            </View>

            <BalanceComparisonCard
                title="Balance esperado (Resumen)"
                expectedLabel="Caja esperada (Resumen):"
                expectedValue={expectedCashSummary}
                actualLabel="Caja guardada:"
                actualValue={totalStoredCents}
                diffValue={diffStoredVsSummary}
                accentColor="#10B981"
                okText="Caja cuadrada"
                surplusText="Sobrante en caja"
                deficitText="Faltante en caja"
            />

            <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Caja (Saldo Guardado)</Text>
                <Text style={styles.totalStoredText}>{formatCents(totalStoredCents)}</Text>
            </View>

            <SoftCard style={styles.storedBalanceContainer}>
                <View style={styles.storedGrid}>
                    {DEFAULT_DENOMS.map((d: number) => (
                        <StoredGridItem
                            key={`s-${d}`}
                            d={d}
                            qty={cashState?.denoms[d.toString()] || 0}
                        />
                    ))}
                </View>
            </SoftCard>

            <View style={[styles.sectionTitleRow, { marginBottom: 10, marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
            </View>
        </View>
    ), [
        salesTabTotal,
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
        cashState,
        DENOMS,
        inputRefs,
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
                <FlatList
                    data={movementRows}
                    keyExtractor={item => item.key}
                    renderItem={renderMovement}
                    ListHeaderComponent={HeaderComponent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay movimientos registrados</Text>}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    removeClippedSubviews={true}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    windowSize={5}
                />

                {deletingId !== null && (
                    <View style={styles.undoContainer}>
                        <Text style={styles.undoText}>Movimiento eliminado</Text>
                        <TouchableOpacity onPress={handleUndoDelete}>
                            <Text style={styles.undoAction}>DESHACER</Text>
                        </TouchableOpacity>
                    </View>
                )}

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
                                <SoftButton label="Eliminar Movimiento" variant="danger" onPress={handleDeleteMovement} style={styles.btnDelete} />
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
    listContent: { paddingHorizontal: 6, paddingTop: theme.spacing.md, paddingBottom: 100 },
    headerContainer: { marginBottom: 10 },
    summaryCard: { padding: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: theme.colors.primary },
    balanceTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    summaryLabel: { fontSize: 12, color: theme.colors.mutedText },
    summaryValue: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
    summaryLabelBold: { fontSize: 13, fontWeight: 'bold', color: theme.colors.text },
    expectedBalanceText: { fontSize: 11, color: theme.colors.mutedText },
    expectedBalanceValue: { fontSize: 11, fontWeight: '700', color: theme.colors.text },
    diffBorder: { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.border },
    diffContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    diffText: { fontSize: 14, fontWeight: 'bold' },
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
    sectionTitleRowCompactTop: { marginTop: 5 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
    totalDraftBig: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
    totalStoredText: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
    tableCard: { padding: 0, overflow: 'hidden', marginBottom: 10 },
    tableHeader: { flexDirection: 'row', backgroundColor: theme.colors.surface2, padding: 6 },
    tableHCell: { fontSize: 11, fontWeight: 'bold', color: theme.colors.mutedText },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    noBorder: { borderBottomWidth: 0 },
    tableCell: { fontSize: 14, color: theme.colors.text },
    tableInput: { width: 70, minHeight: 38 },
    tableInputText: { textAlign: 'center', fontSize: 13, fontWeight: '700' },
    buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    btnAction: { flex: 1 },
    storedBalanceContainer: { padding: 12, marginTop: 4, backgroundColor: theme.colors.surface },
    storedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
    storedGridItemWrapper: { width: '31%', marginBottom: 8, alignItems: 'center' },
    storedDenomHeader: { fontSize: 15, fontWeight: '900', color: theme.colors.text, marginBottom: 2 },
    storedGridItem: { width: '100%', backgroundColor: '#FFF', padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' },
    storedGridQtyBox: { backgroundColor: '#E8EAF6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 2 },
    storedGridQty: { fontSize: 12, fontWeight: 'bold', color: theme.colors.primary },
    storedGridSub: { fontSize: 11, color: '#666', fontWeight: '600' },
    movRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.colors.surface, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
    movTimeCol: { width: 70, alignItems: 'center' },
    movTimeText: { fontSize: 11, color: theme.colors.mutedText, marginTop: 4 },
    movDescCol: { flex: 1, paddingHorizontal: 10 },
    movDescText: { fontSize: 13, color: theme.colors.text },
    movAmountCol: { alignItems: 'flex-end' },
    movAmountText: { fontSize: 14, fontWeight: 'bold' },
    dayHeader: { paddingVertical: 8, paddingHorizontal: 4 },
    dayHeaderText: { fontSize: 12, fontWeight: '700', color: theme.colors.mutedText, textTransform: 'uppercase' },
    undoContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#333', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
    undoText: { color: '#FFF', fontWeight: 'bold' },
    undoAction: { color: '#80CBC4', fontWeight: 'bold', fontSize: 14 },
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
    btnDelete: { marginBottom: 8 }
});
