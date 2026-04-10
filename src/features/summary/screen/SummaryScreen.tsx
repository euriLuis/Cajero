import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { formatCents } from '../../../shared/utils/money';
import { getDayRangeMs, getWeekRangeMs, formatDateShort, formatTimeNoSeconds } from '../../../shared/utils/dates';
import { theme } from '../../../ui/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SoftButton, SoftInput } from '../../../ui/components';
import { useSummaryScreen } from '../hooks/useSummaryScreen';

export const SummaryScreen = () => {
    const insets = useSafeAreaInsets();
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
        setFormAmount,
        formReason,
        setFormReason,
        amountError,
        setAmountError,
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

    const renderHeader = useCallback(() => (
        <View>
            {/* Quick Date Selector */}
            <View style={styles.topBar}>
                <View style={styles.quickButtons}>
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

                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.datePickerText}>{formatDateShort(currentDate.getTime())} 📅</Text>
                </TouchableOpacity>
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
            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
                    <Text style={styles.summaryLabel}>Facturado</Text>
                    <Text style={[styles.summaryValue, styles.summaryValuePrimary]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalSales)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardDanger]}>
                    <Text style={styles.summaryLabel}>Extracciones</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueDanger]} numberOfLines={1} adjustsFontSizeToFit>-{formatCents(totalWithdrawals)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardSuccess]}>
                    <Text style={styles.summaryLabel}>Caja</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueSuccess]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(netBalance)}</Text>
                </View>
            </View>

            {/* Summary Cards - Row 2 */}
            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.summaryCardInfo]}>
                    <Text style={styles.summaryLabel}>Salario diario</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueInfo]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalDailySalary)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardWeekly]}>
                    <Text style={styles.summaryLabel}>Total semanal</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueWeekly]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalWeeklySales)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardSalary]}>
                    <Text style={styles.summaryLabel}>Salario semanal</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueSalary]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalWeeklySalary)}</Text>
                </View>
            </View>

            {/* Products Sold Summary */}
            {productsSold.length > 0 && (
                <View style={styles.productsSection}>
                    <View style={styles.productsSectionHeader}>
                        <Text style={styles.productsSectionTitle}>📦 Productos Vendidos</Text>
                    </View>
                    <View style={styles.productsGrid}>
                        {productsSold.map((product, index) => (
                            <View key={index} style={styles.productItem}>
                                <Text style={styles.productName}>{product.productName}</Text>
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
    ), [currentDate, totalSales, totalWithdrawals, totalWeeklySales, totalDailySalary, totalWeeklySalary, netBalance, showDatePicker, productsSold, todayFlag, yesterdayFlag, handleQuickDate, handleDateChange, setShowDatePicker]);

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
                <Text style={styles.formTitle}>Registrar Extracción</Text>
                <View style={styles.formRow}>
                    <SoftInput
                        containerStyle={[styles.input, { flex: 1 }, amountError && styles.inputError]}
                        placeholder="Monto (0.00)"
                        value={formAmount}
                        onChangeText={handleAmountChange}
                        keyboardType="numeric"
                    />
                    <SoftInput
                        containerStyle={[styles.input, { flex: 2 }]}
                        placeholder="Motivo (opcional)"
                        value={formReason}
                        onChangeText={setFormReason}
                    />
                    <SoftButton
                        label="OK"
                        onPress={handleAddWithdrawal}
                        disabled={!!amountError}
                        style={[styles.addBtn, amountError && styles.addBtnDisabled]}
                    />
                </View>
                {amountError && (
                    <Text style={styles.formErrorText}>{amountError}</Text>
                )}
            </View>

            <View style={styles.card}>
                <FlatList
                    data={withdrawals.filter(w => !pendingDelete || pendingDelete.id !== w.id)}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderWithdrawalItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No hay extracciones registradas</Text>
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={handleRefresh}
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
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    quickButtons: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
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
        margin: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderRadius: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    formTitle: {
        ...theme.typography.caption,
        fontWeight: 'bold',
        marginBottom: theme.spacing.sm,
    },
    formRow: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
    },
    input: {
        minHeight: 46,
    },
    addBtn: {
        minWidth: 64,
        backgroundColor: theme.colors.surface,
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
        fontSize: 12,
        fontWeight: '600',
        marginTop: theme.spacing.xs,
        marginLeft: theme.spacing.md,
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
    productItem: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderWidth: 1,
        borderColor: '#3B82F6',
        minWidth: '45%',
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