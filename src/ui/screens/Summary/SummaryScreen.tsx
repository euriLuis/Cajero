import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { salesRepo, withdrawalsRepo } from '../../../data/repositories';
import { Withdrawal } from '../../../domain/models/Withdrawal';
import { formatCents, parseMoneyToCents } from '../../../utils/money';
import { getDayRangeMs, getWeekRangeMs, formatDateShort, formatTimeNoSeconds } from '../../../utils/dates';
import { theme } from '../../theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { SoftButton, SoftInput } from '../../components';

interface ProductSold {
    productName: string;
    totalQty: number;
}

export const SummaryScreen = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Summary Data
    const [totalSales, setTotalSales] = useState(0);
    const [totalWithdrawals, setTotalWithdrawals] = useState(0);
    const [totalWeeklySales, setTotalWeeklySales] = useState(0);
    const [totalDailySalary, setTotalDailySalary] = useState(0);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [productsSold, setProductsSold] = useState<ProductSold[]>([]);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [formAmount, setFormAmount] = useState('');
    const [formReason, setFormReason] = useState('');
    const [amountError, setAmountError] = useState<string | null>(null);

    // Soft Delete
    const [pendingDelete, setPendingDelete] = useState<{ id: number; withdrawal: Withdrawal } | null>(null);
    const pendingDeleteTimerRef = useRef<NodeJS.Timeout | null>(null);

    const calcSalaryForRange = useCallback(async (startMs: number, endMs: number) => {
        const sales = await salesRepo.sumSalesByRange(startMs, endMs);
        return Math.round(sales * 0.005);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { startMs, endMs } = getDayRangeMs(currentDate);
            const { startMs: weekStartMs, endMs: weekEndMs } = getWeekRangeMs(currentDate);

            const [salesSum, withSum, withList, weeklySalesSum, productsSoldList, salaryDaily] = await Promise.all([
                salesRepo.sumSalesByRange(startMs, endMs),
                withdrawalsRepo.sumWithdrawalsByRange(startMs, endMs),
                withdrawalsRepo.listWithdrawalsByRange(startMs, endMs),
                salesRepo.sumSalesByRange(weekStartMs, weekEndMs),
                salesRepo.getProductsSoldSummary(startMs, endMs),
                calcSalaryForRange(startMs, endMs),
            ]);

            setTotalSales(salesSum);
            setTotalWithdrawals(withSum);
            setWithdrawals(withList);
            setTotalWeeklySales(weeklySalesSum);
            setTotalDailySalary(salaryDaily);
            setProductsSold(productsSoldList);
        } catch (e) {
            Alert.alert('Error', 'No se pudieron cargar los datos de la caja');
        } finally {
            setLoading(false);
        }
    }, [currentDate, calcSalaryForRange]);

    useFocusEffect(
        useCallback(() => {
            loadData();

            // Cleanup timer when leaving screen
            return () => {
                if (pendingDeleteTimerRef.current) {
                    clearTimeout(pendingDeleteTimerRef.current);
                    pendingDeleteTimerRef.current = null;
                }
                // Cancel pending delete when leaving screen
                setPendingDelete(null);
            };
        }, [loadData])
    );

    // Cleanup timer when changing date
    useEffect(() => {
        if (pendingDeleteTimerRef.current) {
            clearTimeout(pendingDeleteTimerRef.current);
            pendingDeleteTimerRef.current = null;
        }
        // Cancel pending delete when date changes
        setPendingDelete(null);
    }, [currentDate]);

    // Cleanup timer on component unmount
    useEffect(() => {
        return () => {
            if (pendingDeleteTimerRef.current) {
                clearTimeout(pendingDeleteTimerRef.current);
                pendingDeleteTimerRef.current = null;
            }
        };
    }, []);

    const handleDateChange = (event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
            setCurrentDate(date);
        }
    };

    const handleQuickDate = (type: 'today' | 'yesterday') => {
        const newDate = new Date();
        if (type === 'yesterday') {
            newDate.setDate(newDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    };

    const validateAmount = (amount: string): { valid: boolean; error?: string; cents?: number } => {
        if (amount.trim() === '') {
            return { valid: false, error: 'Ingresa un monto' };
        }
        const cents = parseMoneyToCents(amount);
        if (isNaN(cents)) {
            return { valid: false, error: 'Monto inválido' };
        }
        if (cents <= 0) {
            return { valid: false, error: 'Monto debe ser > 0' };
        }
        return { valid: true, cents };
    };

    const handleAmountChange = (text: string) => {
        setFormAmount(text);
    };

    const handleAddWithdrawal = async () => {
        // Validate on submit
        const validation = validateAmount(formAmount);

        if (!validation.valid) {
            setAmountError(validation.error || null);
            return;
        }

        const amountCents = validation.cents || 0;

        try {
            // If date is today, use current time. If not, use the selected date at 12:00
            let createdAtMs = Date.now();
            const isToday = formatDateShort(Date.now()) === formatDateShort(currentDate.getTime());

            if (!isToday) {
                const combined = new Date(currentDate);
                combined.setHours(12, 0, 0, 0);
                createdAtMs = combined.getTime();
            }

            await withdrawalsRepo.createWithdrawal(amountCents, formReason, createdAtMs);
            setFormAmount('');
            setFormReason('');
            setAmountError(null);
            loadData();
        } catch (e) {
            Alert.alert('Error', 'No se pudo registrar la extracción');
        }
    };

    const handleDeleteWithdrawal = (withdrawal: Withdrawal) => {
        // Mark as pending delete without confirmation
        setPendingDelete({ id: withdrawal.id, withdrawal });

        // Start 5-second timer
        if (pendingDeleteTimerRef.current) {
            clearTimeout(pendingDeleteTimerRef.current);
        }

        pendingDeleteTimerRef.current = setTimeout(async () => {
            try {
                await withdrawalsRepo.deleteWithdrawal(withdrawal.id);
                setPendingDelete(null);
                loadData();
            } catch (e) {
                Alert.alert('Error', 'No se pudo eliminar la extracción');
                setPendingDelete(null);
            }
        }, 5000);
    };

    const handleCancelDelete = () => {
        if (pendingDeleteTimerRef.current) {
            clearTimeout(pendingDeleteTimerRef.current);
            pendingDeleteTimerRef.current = null;
        }
        setPendingDelete(null);
    };

    const renderHeader = useCallback(() => (
        <View>
            {/* Quick Date Selector */}
            <View style={styles.topBar}>
                <View style={styles.quickButtons}>
                    <TouchableOpacity
                        style={[styles.quickBtn, formatDateShort(currentDate.getTime()) === formatDateShort(Date.now()) && styles.activeQuickBtn]}
                        onPress={() => handleQuickDate('today')}
                    >
                        <Text style={styles.quickBtnText}>Hoy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickBtn, formatDateShort(currentDate.getTime()) === formatDateShort(Date.now() - 86400000) && styles.activeQuickBtn]}
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

            {/* Summary Cards - Grid - Row 1 */}
            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { borderColor: theme.colors.primary }]}>
                    <Text style={styles.summaryLabel}>Facturado</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalSales)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#EF4444' }]}>
                    <Text style={styles.summaryLabel}>Extracciones</Text>
                    <Text style={[styles.summaryValue, { color: '#EF4444' }]} numberOfLines={1} adjustsFontSizeToFit>-{formatCents(totalWithdrawals)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#10B981', backgroundColor: '#F0FDF4' }]}>
                    <Text style={styles.summaryLabel}>Caja</Text>
                    <Text style={[styles.summaryValue, { color: '#10B981' }]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalSales - totalWithdrawals)}</Text>
                </View>
            </View>

            {/* Summary Cards - Grid - Row 2 */}
            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { borderColor: '#8B5CF6' }]}>
                    <Text style={styles.summaryLabel}>Total Semanal</Text>
                    <Text style={[styles.summaryValue, { color: '#8B5CF6' }]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalWeeklySales)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}>
                    <Text style={styles.summaryLabel}>Salario semanal</Text>
                    <Text style={[styles.summaryValue, { color: '#F59E0B' }]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(Math.round(totalWeeklySales * 0.005))}</Text>
                </View>
            </View>

            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { borderColor: '#06B6D4' }]}>
                    <Text style={styles.summaryLabel}>Salario diario</Text>
                    <Text style={[styles.summaryValue, { color: '#06B6D4' }]} numberOfLines={1} adjustsFontSizeToFit>{formatCents(totalDailySalary)}</Text>
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
    ), [currentDate, totalSales, totalWithdrawals, totalWeeklySales, totalDailySalary, showDatePicker, productsSold, handleQuickDate, handleDateChange]);

    const renderWithdrawalItem = ({ item }: { item: Withdrawal }) => (
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
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Caja</Text>
            </View>

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
                    onRefresh={loadData}
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
    },
    header: {
        paddingTop: theme.spacing.lg + 20,
        paddingBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.background,
    },
    title: {
        ...theme.typography.title,
        color: theme.colors.text,
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
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'stretch',
    },
    summaryCard: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.spacing.md,
        borderWidth: 2,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    summaryLabel: {
        ...theme.typography.caption,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.xs,
        textAlign: 'center',
    },
    summaryValue: {
        ...theme.typography.title,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        width: '100%',
    },
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