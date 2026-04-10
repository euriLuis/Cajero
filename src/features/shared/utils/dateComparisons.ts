/**
 * Shared date comparison utilities.
 * All functions are pure and use local device time.
 */

import { formatDateShort } from '../../../shared/utils/dates';

const MS_PER_DAY = 86_400_000;

/**
 * Check if a given date (ms timestamp) corresponds to "today" in local time.
 */
export const isToday = (dateMs: number): boolean => {
    return formatDateShort(dateMs) === formatDateShort(Date.now());
};

/**
 * Check if a given date (ms timestamp) corresponds to "yesterday" in local time.
 */
export const isYesterday = (dateMs: number): boolean => {
    return formatDateShort(dateMs) === formatDateShort(Date.now() - MS_PER_DAY);
};

/**
 * Check if two dates (ms timestamps) fall on the same calendar day in local time.
 */
export const isSameDay = (aMs: number, bMs: number): boolean => {
    return formatDateShort(aMs) === formatDateShort(bMs);
};
