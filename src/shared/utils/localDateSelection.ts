import { formatDateShort } from './dates';

// Calendar selections, not timestamps: a timezone change must not move a chosen date.
export type LocalDateSelection = 'today' | 'yesterday' | { day: string };

export const resolveLocalDate = (selection: LocalDateSelection, now = new Date()): Date => {
    if (typeof selection === 'object') {
        const [year, month, day] = selection.day.split('-').map(Number);
        return new Date(year, month - 1, day, 12);
    }
    const date = new Date(now);
    // Use calendar arithmetic, including on 23/25-hour days.
    date.setHours(12, 0, 0, 0);
    if (selection === 'yesterday') date.setDate(date.getDate() - 1);
    return date;
};

export const selectLocalDate = (date: Date, now = new Date()): LocalDateSelection => {
    const day = formatDateShort(date.getTime());
    return day === formatDateShort(now.getTime()) ? 'today' : { day };
};

export const getLocalDaySnapshot = (now = new Date()): string =>
    `${formatDateShort(now.getTime())}|${now.getTimezoneOffset()}`;

export const getLocalDayCheckDelay = (now = new Date()): number => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    // A bounded check also detects manual clock/timezone changes while active.
    return Math.max(1, Math.min(30_000, midnight.getTime() - now.getTime()));
};
