export { CashCounterScreen } from './screen/CashCounterScreen';
export { useCashCounterScreen } from './hooks/useCashCounterScreen';
export {
    DEFAULT_DENOMS,
    EMPTY_CASH_STATE,
    calculateTotalFromDraft,
    calculateTotalFromState,
    buildDenomsDelta,
    calculateDiff,
    calculateExpectedCash,
    classifyDiff,
    type DenominationsState,
    type QuantitiesDraft,
} from './utils/cashCalculations';
