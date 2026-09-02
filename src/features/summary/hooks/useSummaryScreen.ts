import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { salesRepo, withdrawalsRepo } from '../../../data/repositories';
import type { ProductSoldSummary } from '../../../data/repositories/salesRepo';
import { Withdrawal } from '../../../shared/domain/models/Withdrawal';
import { getDayRangeMs, getWeekRangeMs } from '../../../shared/utils/dates';
import { useLocalDateSelection } from '../../../shared/hooks/useLocalDateSelection';
import { parseMoneyToCents } from '../../../shared/utils/money';
import { useErrorReporter, useSoftNotice } from '../../../ui/components';
import { isToday, isYesterday } from '../../shared/utils/dateComparisons';
import { validateMonetaryAmount } from '../../shared/utils/validation';
import { calculateDailySalary, calculateWeeklySalary } from '../utils/salaryCalculations';

export function useSummaryScreen() {
    const { currentDate, setCurrentDate, selectQuickDate, getSelectedDate, localDay } = useLocalDateSelection();
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [totalSales, setTotalSales] = useState(0);
    const [totalWithdrawals, setTotalWithdrawals] = useState(0);
    const [totalWeeklySales, setTotalWeeklySales] = useState(0);
    const [totalDailySalary, setTotalDailySalary] = useState(0);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [productsSold, setProductsSold] = useState<ProductSoldSummary[]>([]);
    const [loading, setLoading] = useState(false);

    const [formAmount, setFormAmount] = useState('');
    const [formReason, setFormReason] = useState('');
    const [amountError, setAmountError] = useState<string | null>(null);
    const [isSavingWithdrawal, setIsSavingWithdrawal] = useState(false);

    const [pendingDelete, setPendingDelete] = useState<{ id: number; withdrawal: Withdrawal } | null>(null);
    const pendingDeleteTimerRef = useRef<NodeJS.Timeout | null>(null);
    const { showNotice } = useSoftNotice();
    const { reportError } = useErrorReporter();
    const viewKey = `${currentDate.getTime()}|${localDay}`;
    const activeViewKey = useRef(viewKey);
    activeViewKey.current = viewKey;
    const loadVersion = useRef(0);
    const dataViewKey = useRef('');

    const loadData = useCallback(async () => {
        if (activeViewKey.current !== viewKey) return;
        const version = ++loadVersion.current;
        const isCurrent = () => version === loadVersion.current && activeViewKey.current === viewKey;
        if (dataViewKey.current !== viewKey) {
            setTotalSales(0);
            setTotalWithdrawals(0);
            setTotalWeeklySales(0);
            setTotalDailySalary(0);
            setWithdrawals([]);
            setProductsSold([]);
            dataViewKey.current = viewKey;
        }
        setLoading(true);
        try {
            const date = getSelectedDate();
            const { startMs, endMs } = getDayRangeMs(date);
            const { startMs: weekStartMs, endMs: weekEndMs } = getWeekRangeMs(date);

            const [salesSum, withSum, withList, weeklySalesSum, productsSoldList] = await Promise.all([
                salesRepo.sumSalesByRange(startMs, endMs),
                withdrawalsRepo.sumWithdrawalsByRange(startMs, endMs),
                withdrawalsRepo.listWithdrawalsByRange(startMs, endMs),
                salesRepo.sumSalesByRange(weekStartMs, weekEndMs),
                salesRepo.getProductsSoldSummary(startMs, endMs),
            ]);

            if (!isCurrent()) return;
            setTotalSales(salesSum);
            setTotalWithdrawals(withSum);
            setWithdrawals(withList);
            setTotalWeeklySales(weeklySalesSum);
            setTotalDailySalary(calculateDailySalary(salesSum));
            setProductsSold(productsSoldList);
        } catch (error) {
            if (!isCurrent()) return;
            showNotice({ title: 'Error', message: 'No se pudieron cargar los datos de la caja', type: 'error' });
            reportError({
                title: 'Error cargando resumen',
                message: 'No se pudieron cargar los datos de la caja',
                source: 'Resumen / Cargar datos',
                error,
                reproductionSteps: 'Abrir la seccion Resumen o cambiar la fecha seleccionada.',
                details: `Fecha seleccionada: ${currentDate.toISOString()}`,
            });
        } finally {
            if (isCurrent()) setLoading(false);
        }
    }, [viewKey, getSelectedDate, currentDate, showNotice, reportError]);
    const latestLoadData = useRef(loadData);
    latestLoadData.current = loadData;

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                loadVersion.current += 1;
                if (pendingDeleteTimerRef.current) {
                    clearTimeout(pendingDeleteTimerRef.current);
                    pendingDeleteTimerRef.current = null;
                }
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
        setPendingDelete(null);
    }, [currentDate]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pendingDeleteTimerRef.current) {
                clearTimeout(pendingDeleteTimerRef.current);
                pendingDeleteTimerRef.current = null;
            }
        };
    }, []);

    const handleDateChange = useCallback((event: any, date?: Date) => {
        setShowDatePicker(false);
        if (event.type === 'set' && date) setCurrentDate(date);
    }, [setCurrentDate]);

    const handleQuickDate = useCallback((type: 'today' | 'yesterday') => {
        selectQuickDate(type);
    }, [selectQuickDate]);

    const validateAmount = useCallback((amount: string) => {
        const normalized = amount.trim().replace(/[$ ]/g, '').replace(',', '.');
        if (normalized === '') {
            return { valid: false as const, error: 'Ingresa un monto' };
        }
        if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
            return { valid: false as const, error: 'Usa un monto valido' };
        }
        return validateMonetaryAmount(amount, parseMoneyToCents);
    }, []);

    const handleAmountChange = useCallback((text: string) => {
        setFormAmount(text);
        if (text.trim() === '') {
            setAmountError(null);
            return;
        }

        const validation = validateAmount(text);
        setAmountError(validation.valid ? null : validation.error);
    }, [validateAmount]);

    const handleAddWithdrawal = useCallback(async () => {
        if (isSavingWithdrawal) return;

        const validation = validateAmount(formAmount);
        if (!validation.valid) {
            setAmountError(validation.error || null);
            return;
        }

        const amountCents = validation.value;

        try {
            setIsSavingWithdrawal(true);
            const now = new Date();
            let createdAtMs = now.getTime();
            const date = getSelectedDate(now);
            if (!isToday(date.getTime(), now)) {
                const combined = new Date(date);
                combined.setHours(12, 0, 0, 0);
                createdAtMs = combined.getTime();
            }

            await withdrawalsRepo.createWithdrawal(amountCents, formReason.trim(), createdAtMs);
            setFormAmount('');
            setFormReason('');
            setAmountError(null);
            await latestLoadData.current();
        } catch (error) {
            showNotice({ title: 'Error', message: 'No se pudo registrar la extracción', type: 'error' });
            reportError({
                title: 'Error registrando extraccion',
                message: 'No se pudo registrar la extraccion',
                source: 'Resumen / Registrar extraccion',
                error,
                reproductionSteps: 'Abrir Resumen, escribir monto y motivo, y tocar OK.',
                details: `Monto: ${formAmount || '(vacio)'} | Motivo: ${formReason || '(vacio)'} | Fecha: ${currentDate.toISOString()}`,
            });
        } finally {
            setIsSavingWithdrawal(false);
        }
    }, [formAmount, formReason, currentDate, getSelectedDate, validateAmount, loadData, showNotice, isSavingWithdrawal, reportError]);

    const handleDeleteWithdrawal = useCallback((withdrawal: Withdrawal) => {
        setPendingDelete({ id: withdrawal.id, withdrawal });

        if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);

        pendingDeleteTimerRef.current = setTimeout(async () => {
            try {
                await withdrawalsRepo.deleteWithdrawal(withdrawal.id);
                setPendingDelete(null);
                latestLoadData.current();
            } catch (error) {
                showNotice({ title: 'Error', message: 'No se pudo eliminar la extracción', type: 'error' });
                reportError({
                    title: 'Error eliminando extraccion',
                    message: 'No se pudo eliminar la extraccion',
                    source: 'Resumen / Eliminar extraccion',
                    error,
                    reproductionSteps: 'Abrir Resumen, tocar eliminar en una extraccion y esperar la confirmacion.',
                    details: `Extraccion: #${withdrawal.id} | Monto: ${withdrawal.amountCents} centavos`,
                });
                setPendingDelete(null);
            }
        }, 5000);
    }, [loadData, showNotice, reportError]);

    const handleCancelDelete = useCallback(() => {
        if (pendingDeleteTimerRef.current) {
            clearTimeout(pendingDeleteTimerRef.current);
            pendingDeleteTimerRef.current = null;
        }
        setPendingDelete(null);
    }, []);

    const handleRefresh = useCallback(() => loadData(), [loadData]);

    const currentDateMs = currentDate.getTime();
    const todayFlag = isToday(currentDateMs);
    const yesterdayFlag = isYesterday(currentDateMs);
    const totalWeeklySalary = calculateWeeklySalary(totalWeeklySales);
    const netBalance = totalSales - totalWithdrawals;

    return {
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
        setAmountError,
        isSavingWithdrawal,
        pendingDelete,
        todayFlag,
        yesterdayFlag,
        handleDateChange,
        handleQuickDate,
        validateAmount,
        handleAmountChange,
        handleAddWithdrawal,
        handleDeleteWithdrawal,
        handleCancelDelete,
        handleRefresh,
    };
}
