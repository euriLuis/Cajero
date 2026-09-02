import { useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getLocalDay, subscribeLocalDay, syncLocalDay } from '../time/localDayStore';

export function useLocalDay() {
    const day = useSyncExternalStore(subscribeLocalDay, getLocalDay);
    useFocusEffect(syncLocalDay);
    return day;
}
