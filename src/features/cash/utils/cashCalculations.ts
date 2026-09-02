/**
 * Cash calculations for the Caja / Cash Counter feature.
 * All functions are pure and work with cents values.
 */

export type DenominationsState = Record<string, number>;
export type QuantitiesDraft = Record<string, string>;

/** Default denomination keys in the system */
export const DEFAULT_DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5] as const;

/** Empty cash state: all denominations at zero */
export const EMPTY_CASH_STATE: DenominationsState = {
    "5000": 0,
    "2000": 0,
    "1000": 0,
    "500": 0,
    "200": 0,
    "100": 0,
    "50": 0,
    "20": 0,
    "10": 0,
    "5": 0,
};

/** Validate at the write boundary, including values loaded from JSON. */
export const validateCashDenominations = (
    value: unknown,
    denoms: readonly number[] = DEFAULT_DENOMS,
): number => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('El desglose de denominaciones de caja no es válido.');
    }
    let total = 0;
    for (const [key, qty] of Object.entries(value)) {
        const denom = Number(key);
        if (String(denom) !== key || !denoms.includes(denom)) {
            throw new Error(`La denominación $${key} no está admitida en el contador.`);
        }
        if (typeof qty !== 'number' || !Number.isSafeInteger(qty) || qty < 0) {
            throw new Error(`La cantidad de billetes de $${key} debe ser un número entero no negativo.`);
        }
        total += denom * 100 * qty;
        if (!Number.isSafeInteger(total)) {
            throw new Error('El importe de caja supera el límite seguro. Reduce las cantidades.');
        }
    }
    return total;
};

/**
 * Calculate the total in cents from a quantities draft (string values from UI inputs).
 * Each denomination value is multiplied by 100 to convert to cents.
 */
export const calculateTotalFromDraft = (
    quantities: QuantitiesDraft,
    denoms: readonly number[] = DEFAULT_DENOMS,
): number => {
    return denoms.reduce((sum, denom) => {
        const qtyStr = quantities[denom.toString()] || '';
        const qty = parseInt(qtyStr, 10) || 0;
        return sum + denom * 100 * qty;
    }, 0);
};

/**
 * Calculate the total in cents from a persisted cash state (numeric counts).
 * Each denomination value is multiplied by 100 to convert to cents.
 */
export const calculateTotalFromState = (
    denomsState: DenominationsState,
    denoms: readonly number[] = DEFAULT_DENOMS,
): number => {
    return denoms.reduce((sum, d) => sum + d * 100 * (denomsState[d.toString()] || 0), 0);
};

/**
 * Build a denominations delta object for a movement,
 * filtering out entries with zero quantity.
 */
export const buildDenomsDelta = (
    quantities: QuantitiesDraft,
    denoms: readonly number[] = DEFAULT_DENOMS,
): Record<string, number> => {
    const delta: Record<string, number> = {};
    for (const d of denoms) {
        const raw = quantities[d.toString()] ?? '';
        if (typeof raw !== 'string' || (raw.trim() !== '' && !/^\d+$/.test(raw.trim()))) {
            throw new Error(`La cantidad de billetes de $${d} debe ser un número entero no negativo.`);
        }
        const qty = Number(raw.trim());
        if (!Number.isSafeInteger(qty)) {
            throw new Error(`La cantidad de billetes de $${d} supera el límite seguro.`);
        }
        if (qty > 0) {
            delta[d.toString()] = qty;
        }
    }
    validateCashDenominations(delta, denoms);
    return delta;
};

/**
 * Calculate the difference between two amounts in cents.
 * Positive = surplus, Negative = deficit, Zero = balanced.
 */
export const calculateDiff = (actualCents: number, expectedCents: number): number => {
    return actualCents - expectedCents;
};

/**
 * Calculate the expected cash balance:
 * total sales minus total withdrawals.
 */
export const calculateExpectedCash = (salesCents: number, withdrawalsCents: number): number => {
    return salesCents - withdrawalsCents;
};

/**
 * Classify a cash difference into a human-readable status label.
 */
export const classifyDiff = (
    diffCents: number,
    labels?: { ok?: string; surplus?: string; deficit?: string },
): string => {
    if (diffCents > 0) return labels?.surplus ?? 'SOBRA';
    if (diffCents < 0) return labels?.deficit ?? 'FALTA';
    return labels?.ok ?? 'OK';
};
