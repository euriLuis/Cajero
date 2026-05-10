import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, TextInput } from 'react-native';
import { cashRepo, salesRepo, withdrawalsRepo } from '../../../data/repositories';
import { CashMovement, CashState } from '../../../data/repositories/cashRepo';
import { getDayRangeMs, formatDateShort } from '../../../shared/utils/dates';
import { formatCents } from '../../../shared/utils/money';
import { useErrorReporter, useSoftNotice } from '../../../ui/components';
import {
    DEFAULT_DENOMS,
    calculateTotalFromDraft,
    calculateTotalFromState,
    calculateExpectedCash,
    calculateDiff,
    buildDenomsDelta,
    type QuantitiesDraft,
} from '../utils/cashCalculations';

type QuantitiesState = Record<string, string>;

export function useCashCounterScreen() {
    const [quantities, setQuantities] = useState<QuantitiesState>({});
    const [cashState, setCashState] = useState<CashState | null>(null);
    const [movements, setMovements] = useState<CashMovement[]>([]);
    const [totalSalesToday, setTotalSalesToday] = useState<number>(0);
    const [salesTabTotal, setSalesTabTotal] = useState<number>(0);
    const [totalWithdrawalsToday, setTotalWithdrawalsToday] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const { showNotice } = useSoftNotice();
    const { reportError } = useErrorReporter();

    const inputRefs = useRef<Record<number, TextInput | null>>({});
    const initialLoadDone = useRef(false);
    const lastSavedDraftRef = useRef(JSON.stringify({}));

    const loadData = useCallback(async (isRefresh = false) => {
        if (!isRefresh && !initialLoadDone.current) setLoading(true);
        else setRefreshing(true);

        try {
            await cashRepo.resetCashStateIfNewDay();

            const [draft, state, movs, salesDraftTotal, { startMs, endMs }] = await Promise.all([
                cashRepo.getCashCounterDraft(),
                cashRepo.getCashState(),
                cashRepo.listCashMovements(20),
                salesRepo.getCurrentSaleDraftTotal(),
                getDayRangeMs(new Date())
            ]);

            const initial: QuantitiesState = {};
            DEFAULT_DENOMS.forEach(d => {
                initial[d.toString()] = draft[d.toString()] || '';
            });

            lastSavedDraftRef.current = JSON.stringify(initial);
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
            showNotice({ title: 'Error', message: 'No se pudieron cargar los datos de caja', type: 'error' });
            reportError({
                title: 'Error cargando contador',
                message: 'No se pudieron cargar los datos de caja',
                source: 'Contador / Cargar datos',
                error,
                reproductionSteps: 'Abrir la seccion Contador o hacer pull-to-refresh.',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showNotice, reportError]);

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            };
        }, [loadData])
    );

    // Persist the draft only when the user changed it; loading the stored draft should not write it back.
    useEffect(() => {
        const serialized = JSON.stringify(quantities);
        if (serialized === lastSavedDraftRef.current) {
            return;
        }

        const timer = setTimeout(() => {
            lastSavedDraftRef.current = serialized;
            cashRepo.setCashCounterDraft(quantities);
        }, 500);
        return () => clearTimeout(timer);
    }, [quantities]);

    const handleQuantityChange = useCallback((denom: number, text: string) => {
        const key = denom.toString();
        setQuantities(prev => {
            if (prev[key] === text) return prev;
            return {
                ...prev,
                [key]: text,
            };
        });
    }, []);

    const handleNextInput = useCallback((index: number) => {
        if (index < DEFAULT_DENOMS.length - 1) {
            const nextDenom = DEFAULT_DENOMS[index + 1];
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
                    DEFAULT_DENOMS.forEach(d => (reset[d.toString()] = ''));
                    lastSavedDraftRef.current = JSON.stringify(reset);
                    setQuantities(reset);
                    cashRepo.setCashCounterDraft(reset);
                },
            },
        ]);
    }, []);

    const totalContadoCents = useMemo(() => {
        return calculateTotalFromDraft(quantities as QuantitiesDraft);
    }, [quantities]);

    const diffConteoVsVentas = useMemo(
        () => calculateDiff(totalContadoCents, salesTabTotal),
        [totalContadoCents, salesTabTotal]
    );

    const totalStoredCents = useMemo(() => {
        if (!cashState) return 0;
        return calculateTotalFromState(cashState.denoms);
    }, [cashState]);

    const expectedCashSummary = useMemo(
        () => calculateExpectedCash(totalSalesToday, totalWithdrawalsToday),
        [totalSalesToday, totalWithdrawalsToday]
    );

    const diffStoredVsSummary = useMemo(
        () => calculateDiff(totalStoredCents, expectedCashSummary),
        [totalStoredCents, expectedCashSummary]
    );

    const handleApplyMovement = useCallback(async (type: 'IN' | 'OUT') => {
        if (totalContadoCents === 0) {
            showNotice({ title: 'Conteo vacío', message: 'Ingresa cantidades antes de aplicar un movimiento.', type: 'info' });
            return;
        }

        const denomsDelta = buildDenomsDelta(quantities as QuantitiesDraft);

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
                            DEFAULT_DENOMS.forEach(d => (reset[d.toString()] = ''));
                            lastSavedDraftRef.current = JSON.stringify(reset);
                            await cashRepo.setCashCounterDraft(reset);
                            setQuantities(reset);
                            await loadData(true);
                        } catch (error: any) {
                            showNotice({ title: 'Error', message: error.message, type: 'error' });
                            reportError({
                                title: 'Error aplicando movimiento de caja',
                                message: error.message || 'No se pudo aplicar el movimiento de caja',
                                source: 'Contador / Aplicar movimiento',
                                error,
                                reproductionSteps: 'Abrir Contador, ingresar denominaciones y confirmar AGREGAR o RESTAR.',
                                details: `Tipo: ${type} | Total: ${totalContadoCents} centavos`,
                            });
                        }
                    }
                }
            ]
        );
    }, [totalContadoCents, quantities, loadData, showNotice, reportError]);

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
                showNotice({ title: 'Error', message: error.message || 'No se pudo eliminar el movimiento', type: 'error' });
                reportError({
                    title: 'Error eliminando movimiento de caja',
                    message: error.message || 'No se pudo eliminar el movimiento',
                    source: 'Contador / Eliminar movimiento',
                    error,
                    reproductionSteps: 'Abrir Contador, entrar al detalle de un movimiento, eliminarlo y esperar la confirmacion.',
                    details: `Movimiento: #${idToDelete}`,
                });
                setDeletingId(null);
            }
        }, 4000);
    }, [selectedMovement, loadData, showNotice, reportError]);

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

    const movementRows = useMemo(() => {
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

    const handleRefresh = useCallback(() => loadData(true), [loadData]);

    return {
        // Data
        quantities,
        cashState,
        salesTabTotal,
        loading,
        refreshing,
        deletingId,
        selectedMovement,
        detailModalVisible,
        setDetailModalVisible,
        inputRefs,

        // Computed
        totalContadoCents,
        diffConteoVsVentas,
        totalStoredCents,
        expectedCashSummary,
        diffStoredVsSummary,
        movementRows,

        // Handlers
        handleQuantityChange,
        handleNextInput,
        handleResetDraft,
        handleApplyMovement,
        handleDeleteMovement,
        handleUndoDelete,
        handleOpenDetail,
        handleRefresh,
    };
}

type MovementListRow =
    | { type: 'day'; key: string; dayLabel: string }
    | { type: 'movement'; key: string; movement: CashMovement };
