/**
 * Shared validation utilities for numeric user input.
 * All functions are pure: no side effects, no I/O.
 */

export type ValidationResult<T = number> =
    | { valid: true; value: T }
    | { valid: false; error: string };

/**
 * Validate a quantity string: must be a positive integer >= 1.
 * Empty string is treated as valid with default value of 1.
 */
export const validateQuantity = (qtyStr: string): ValidationResult<number> => {
    if (qtyStr.trim() === '') {
        return { valid: true, value: 1 };
    }
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty)) {
        return { valid: false, error: 'Cantidad debe ser un número' };
    }
    if (qty < 1) {
        return { valid: false, error: 'Cantidad debe ser >= 1' };
    }
    return { valid: true, value: qty };
};

/**
 * Validate a monetary amount string: must be parseable as cents and > 0.
 */
export const validateMonetaryAmount = (amountStr: string, parseFn: (s: string) => number): ValidationResult<number> => {
    if (amountStr.trim() === '') {
        return { valid: false, error: 'Ingresa un monto' };
    }
    const cents = parseFn(amountStr);
    if (isNaN(cents)) {
        return { valid: false, error: 'Monto inválido' };
    }
    if (cents <= 0) {
        return { valid: false, error: 'Monto debe ser > 0' };
    }
    return { valid: true, value: cents };
};

/**
 * Resolve a draft qty string to the effective number.
 * If draft is empty, falls back to the original value.
 */
export const resolveDraftQty = (draftQty: string, originalQty: number): number => {
    return draftQty !== '' ? parseInt(draftQty, 10) || originalQty : originalQty;
};

/**
 * Resolve a draft price string to the effective cents value.
 * If draft is empty, falls back to the original cents.
 */
export const resolveDraftPrice = (draftPrice: string, originalCents: number, parseFn: (s: string) => number): number => {
    return draftPrice !== '' ? parseFn(draftPrice) : originalCents;
};

