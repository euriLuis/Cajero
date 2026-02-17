export const getDayRangeMs = (date: Date): { startMs: number; endMs: number } => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return {
        startMs: start.getTime(),
        endMs: end.getTime(),
    };
};

export const getWeekRangeMs = (date: Date): { startMs: number; endMs: number } => {
    const start = new Date(date);
    const dayOfWeek = start.getDay();
    // Ajusta para que la semana empiece en lunes (1) a domingo (0)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(start.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
        startMs: start.getTime(),
        endMs: end.getTime(),
    };
};

export const formatDateTime = (ms: number): string => {
    const date = new Date(ms);
    return date.toLocaleString();
};

export const formatDateShort = (ms: number): string => {
    const date = new Date(ms);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
export const formatTimeNoSeconds = (ms: number): string => {
    const date = new Date(ms);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

export const formatDateTimeWithSeconds = (ms: number): string => {
    const date = new Date(ms);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
};
