/**
 * Shared date comparison utilities.
 * All functions are pure and use local device time.
 */

import { formatDateShort } from '../../../shared/utils/dates';

/**
 * Check if a given date (ms timestamp) corresponds to "today" in local time.
 */
export const isToday = (dateMs: number, now = new Date()): boolean => {
    return formatDateShort(dateMs) === formatDateShort(now.getTime());
};

/**
 * Check if a given date (ms timestamp) corresponds to "yesterday" in local time.
 */
export const isYesterday = (dateMs: number, now = new Date()): boolean => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateShort(dateMs) === formatDateShort(yesterday.getTime());
};

/**
 * Check if two dates (ms timestamps) fall on the same calendar day in local time.
 */
export const isSameDay = (aMs: number, bMs: number): boolean => {
    return formatDateShort(aMs) === formatDateShort(bMs);
};
