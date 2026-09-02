import { useCallback, useMemo, useState } from 'react';
import { useLocalDay } from './useLocalDay';
import { LocalDateSelection, resolveLocalDate, selectLocalDate } from '../utils/localDateSelection';
import { syncLocalDay } from '../time/localDayStore';

export function useLocalDateSelection() {
    const localDay = useLocalDay();
    const [selection, setSelection] = useState<LocalDateSelection>('today');
    const currentDate = useMemo(() => resolveLocalDate(selection), [selection, localDay]);
    // Read the clock again at the action boundary, even before a suspended timer fires.
    const getSelectedDate = useCallback((now = new Date()) => {
        syncLocalDay();
        return resolveLocalDate(selection, now);
    }, [selection]);
    const setCurrentDate = useCallback((date: Date) => {
        syncLocalDay();
        setSelection(selectLocalDate(date));
    }, []);
    const selectQuickDate = useCallback((type: 'today' | 'yesterday') => {
        syncLocalDay();
        setSelection(type);
    }, []);
    return { currentDate, setCurrentDate, selectQuickDate, getSelectedDate, localDay };
}
