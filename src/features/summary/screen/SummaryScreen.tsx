import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { formatCents } from '../../../shared/utils/money';
import { formatDateShort, formatTimeNoSeconds } from '../../../shared/utils/dates';
import { theme } from '../../../ui/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SoftInput } from '../../../ui/components';
import { useFloatingTabBarClearance } from '../../../ui/navigation/safeAreaMetrics';
import { useSummaryScreen } from '../hooks/useSummaryScreen';

export const SummaryScreen = () => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 390;
    const bottomClearance = useFloatingTabBarClearance(theme.spacing.md);
    const {
        currentDate,
        showDatePicker,
        setShowDatePicker,
        totalSales,
        totalWithdrawals,
        totalWeeklySales,
        totalDailySalary,
        totalWeeklySalary,
        netBalance,
        withdrawals,
        productsSold,
        loading,
        formAmount,
        formReason,
        setFormReason,
        amountError,
        isSavingWithdrawal,
        pendingDelete,
        todayFlag,
        yesterdayFlag,
        handleDateChange,
        handleQuickDate,
        handleAmountChange,
        handleAddWithdrawal,
        handleDeleteWithdrawal,
        handleCancelDelete,
        handleRefresh,
    } = useSummaryScreen();

    const visibleWithdrawals = useMemo(
        () => withdrawals.filter(w => !pendingDelete || pendingDelete.id !== w.id),
        [withdrawals, pendingDelete]
    );

    const renderHeader = useCallback(() => (
        <View>
            {/* Quick Date Selector */}
            <View style={[styles.topBar, isCompact && styles.topBarCompact]}>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.datePickerText} numberOfLines={1}>
                        {formatDateShort(currentDate.getTime())} 📅
                    </Text>
                </TouchableOpacity>

                <View style={[styles.quickButtons, isCompact && styles.quickButtonsCompact]}>
                    <TouchableOpacity
                        style={[styles.quickBtn, todayFlag && styles.activeQuickBtn]}
                        onPress={() => handleQuickDate('today')}
                    >
                        <Text style={styles.quickBtnText}>Hoy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickBtn, yesterdayFlag && styles.activeQuickBtn]}
                        onPress={() => handleQuickDate('yesterday')}
                    >
                        <Text style={styles.quickBtnText}>Ayer</Text>
                    </TouchableOpacity>
                </View>

            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={currentDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            )}

            {/* Summary Cards - Row 1 */}
            <View style={[styles.summaryContainer, isCompact && styles.summaryContainerCompact]}>
                <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact, styles.summaryCardPrimary]}>
                    <Text style={[styles.summaryLabel, isCompact && styles.summaryLabelCompact]}>Facturado</Text>
                    <Text style={[styles.summaryValue, isCompact && styles.summaryValueCompact, styles.summaryValuePrimary]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatCents(totalSales)}</Text>
                </View>
                <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact, styles.summaryCardDanger]}>
                    <Text style={[styles.summaryLabel, isCompact && styles.summaryLabelCompact]}>Extracciones</Text>
                    <Text style={[styles.summaryValue, isCompact && styles.summaryValueCompact, styles.summaryValueDanger]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>-{formatCents(totalWithdrawals)}</Text>
                </View>
                <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact, styles.summaryCardSuccess]}>
                    <Text style={[styles.summaryLabel, isCompact && styles.summaryLabelCompact]}>Caja</Text>
                    <Text style={[styles.summaryValue, isCompact && styles.summaryValueCompact, styles.summaryValueSuccess]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatCents(netBalance)}</Text>
                </View>
            </View>

            {/* Summary Cards - Row 2 */}
            <View style={[styles.summaryContainer, isCompact && styles.summaryContainerCompact]}>
                <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact, styles.summaryCardInfo]}>
                    <Text style={[styles.summaryLabel, isCompact && styles.summaryLabelCompact]}>Salario diario</Text>
                    <Text style={[styles.summaryValue, isCompact && styles.summaryValueCompact, styles.summaryValueInfo]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatCents(totalDailySalary)}</Text>
                </View>
                <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact, styles.summaryCardWeekly]}>
                    <Text style={[styles.summaryLabel, isCompact && styles.summaryLabelCompact]}>Total semanal</Text>
                    <Text style={[styles.summaryValue, isCompact && styles.summaryValueCompact, styles.summaryValueWeekly]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatCents(totalWeeklySales)}</Text>
                </View>
                <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact, styles.summaryCardSalary]}>
                    <Text style={[styles.summaryLabel, isCompact && styles.summaryLabelCompact]}>Salario semanal</Text>
                    <Text style={[styles.summaryValue, isCompact && styles.summaryValueCompact, styles.summaryValueSalary]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatCents(totalWeeklySalary)}</Text>
                </View>
            </View>

            {/* Products Sold Summary */}
            {productsSold.length > 0 && (
                <View style={styles.productsSection}>
                    <View style={styles.productsSectionHeader}>
                        <Text style={styles.productsSectionTitle}>📦 Productos Vendidos</Text>
                    </View>
                    <View style={[styles.productsGrid, isCompact && styles.productsGridCompact]}>
                        {productsSold.map((product, index) => (
                            <View key={index} style={[styles.productItem, isCompact && styles.productItemCompact]}>
                                <Text style={styles.productName} numberOfLines={1}>{product.productName}</Text>
                                <Text style={styles.productQty}>Total: {product.totalQty}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Movimientos de Caja</Text>
            </View>
        </View>
    ), [currentDate, totalSales, totalWithdrawals, totalWeeklySales, totalDailySalary, totalWeeklySalary, netBalance, showDatePicker, productsSold, todayFlag, yesterdayFlag, handleQuickDate, handleDateChange, setShowDatePicker, isCompact]);

    const renderWithdrawalItem = useCallback(({ item }: { item: typeof withdrawals[number] }) => (
        <TouchableOpacity
            style={styles.withdrawalItem}
            onLongPress={() => handleDeleteWithdrawal(item)}
        >
            <View style={styles.withdrawalInfo}>
                <Text style={styles.withdrawalTime}>{formatTimeNoSeconds(item.createdAt)}</Text>
                <Text style={styles.withdrawalReason}>{item.reason || 'Sin motivo'}</Text>
            </View>
            <View style={styles.withdrawalAmountContainer}>
                <Text style={styles.withdrawalAmount}>-{formatCents(item.amountCents)}</Text>
                <TouchableOpacity onPress={() => handleDeleteWithdrawal(item)}>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    ), [handleDeleteWithdrawal]);

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) + 4 }]}>

            {/* Withdrawal Form */}
            <View style={styles.formCard}>
                <View style={styles.formHeaderRow}>
                    <Text style={styles.formTitle}>Registrar Extracción</Text>
                    {amountError && <Text style={styles.formErrorText} numberOfLines={1}>{amountError}</Text>}
                </View>
                <View style={styles.formRow}>
                    <View style={styles.formInputsRow}>
                        <SoftInput
                            size="compact"
                            leftIcon="$"
                            containerStyle={[styles.input, styles.amountInput, amountError && styles.inputError]}
                            inputStyle={styles.formInputText}
                            placeholder="Monto"
                            value={formAmount}
                            onChangeText={handleAmountChange}
                            keyboardType="numeric"
                            returnKeyType="next"
                        />
                        <SoftInput
                            size="compact"
                            containerStyle={[styles.input, styles.reasonInput]}
                            inputStyle={styles.formInputText}
                            placeholder="Motivo"
                            value={formReason}
                            onChangeText={setFormReason}
                            returnKeyType="done"
                            onSubmitEditing={handleAddWithdrawal}
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.addBtn, (amountError || isSavingWithdrawal) && styles.addBtnDisabled]}
                        onPress={handleAddWithdrawal}
                        disabled={!!amountError || isSavingWithdrawal}
                        activeOpacity={0.86}
                    >
                        <Text style={styles.addBtnText}>{isSavingWithdrawal ? '...' : 'OK'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.card}>
                <FlatList
                    data={visibleWithdrawals}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderWithdrawalItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No hay extracciones registradas</Text>
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance }]}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                    removeClippedSubviews={true}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    windowSize={5}
                    keyboardShouldPersistTaps="handled"
                />

                {/* Undo Delete Bar */}
                {pendingDelete && (
                    <View style={styles.undoBar}>
                        <Text style={styles.undoText}>Extracción eliminada</Text>
                        <TouchableOpacity style={styles.undoBtn} onPress={handleCancelDelete}>
                            <Text style={styles.undoBtnText}>Deshacer</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};

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
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    topBarCompact: {
        padding: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    quickButtons: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
        flexShrink: 0,
    },
    quickButtonsCompact: {
        gap: 4,
    },
    quickBtn: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    activeQuickBtn: {
        borderColor: theme.colors.primary,
        backgroundColor: '#EEF2FF',
    },
    quickBtnText: {
        ...theme.typography.caption,
        fontWeight: 'bold',
    },
    datePickerBtn: {
        flex: 1,
        minWidth: 0,
        paddingVertical: theme.spacing.xs,
    },
    datePickerText: {
        ...theme.typography.body,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    summaryContainer: {
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.xs,
        gap: theme.spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'stretch',
    },
    summaryContainerCompact: {
        paddingHorizontal: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    summaryCard: {
        flex: 1,
        minHeight: 88,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.control,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.softControlShadow,
    },
    summaryCardCompact: {
        minHeight: 76,
        paddingVertical: 6,
        paddingHorizontal: 5,
    },
    summaryCardPrimary: { borderColor: 'rgba(14,18,32,0.16)' },
    summaryCardDanger: { borderColor: 'rgba(239,68,68,0.24)' },
    summaryCardSuccess: { borderColor: 'rgba(16,185,129,0.22)' },
    summaryCardInfo: { borderColor: 'rgba(6,182,212,0.22)' },
    summaryCardWeekly: { borderColor: 'rgba(139,92,246,0.22)' },
    summaryCardSalary: { borderColor: 'rgba(245,158,11,0.24)' },
    summaryLabel: {
        ...theme.typography.caption,
        fontWeight: '700',
        color: theme.colors.mutedText,
        marginBottom: theme.spacing.xs,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        fontSize: 11,
    },
    summaryLabelCompact: {
        fontSize: 9,
        marginBottom: 3,
    },
    summaryValue: {
        ...theme.typography.subtitle,
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        width: '100%',
    },
    summaryValuePrimary: { color: theme.colors.primary },
    summaryValueDanger: { color: '#D14343' },
    summaryValueSuccess: { color: '#18956A' },
    summaryValueInfo: { color: '#0F8FA5' },
    summaryValueWeekly: { color: '#7E4CC7' },
    summaryValueSalary: { color: '#C98514' },
    formCard: {
        marginHorizontal: theme.spacing.md,
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        backgroundColor: theme.colors.background,
        borderRadius: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    formHeaderRow: {
        minHeight: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xs,
    },
    formTitle: {
        ...theme.typography.caption,
        fontWeight: 'bold',
        color: theme.colors.text,
        flexShrink: 0,
    },
    formRow: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
        alignItems: 'center',
    },
    formInputsRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        gap: theme.spacing.xs,
    },
    input: {
        minHeight: 38,
    },
    amountInput: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    reasonInput: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    formInputText: {
        fontSize: 13,
        paddingVertical: 4,
    },
    summaryValueCompact: {
        fontSize: 13,
    },
    addBtn: {
        width: 42,
        minHeight: 38,
        borderRadius: theme.spacing.sm,
        backgroundColor: theme.colors.success,
        borderWidth: 1,
        borderColor: 'rgba(30,154,98,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.softControlShadow,
    },
    addBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    listHeader: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    listTitle: {
        ...theme.typography.body,
        fontWeight: 'bold',
    },
    listContent: {
        paddingBottom: theme.spacing.md,
    },
    withdrawalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: theme.spacing.md,
        alignItems: 'center',
    },
    withdrawalInfo: {
        flex: 1,
    },
    withdrawalTime: {
        ...theme.typography.caption,
        fontWeight: 'bold',
    },
    withdrawalReason: {
        ...theme.typography.body,
        fontSize: 14,
        color: theme.colors.mutedText,
    },
    withdrawalAmountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    withdrawalAmount: {
        ...theme.typography.body,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    deleteIcon: {
        fontSize: 18,
    },
    separator: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    emptyText: {
        textAlign: 'center',
        padding: theme.spacing.xl,
        color: theme.colors.mutedText,
    },
    undoBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: '#FEF3C7',
        borderTopWidth: 1,
        borderTopColor: '#FCD34D',
        gap: theme.spacing.md,
    },
    undoText: {
        ...theme.typography.body,
        fontWeight: '600',
        color: '#92400E',
        flex: 1,
    },
    undoBtn: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        backgroundColor: '#FBBF24',
        borderRadius: theme.spacing.sm,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    undoBtnText: {
        ...theme.typography.caption,
        fontWeight: '600',
        color: '#78350F',
    },
    inputError: {
        borderColor: '#DC2626',
        borderWidth: 1,
    },
    addBtnDisabled: {
        opacity: 0.5,
    },
    formErrorText: {
        color: '#DC2626',
        fontSize: 11,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    productsSection: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    productsSectionHeader: {
        marginBottom: theme.spacing.md,
    },
    productsSectionTitle: {
        ...theme.typography.subtitle,
        fontWeight: '600',
        color: theme.colors.text,
    },
    productsGrid: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
    },
    productsGridCompact: {
        gap: theme.spacing.sm,
    },
    productItem: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderWidth: 1,
        borderColor: '#3B82F6',
        minWidth: '45%',
    },
    productItemCompact: {
        minWidth: 0,
        width: '48%',
        paddingHorizontal: theme.spacing.sm,
    },
    productName: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    productQty: {
        ...theme.typography.caption,
        color: '#3B82F6',
        fontWeight: '600',
    },});
