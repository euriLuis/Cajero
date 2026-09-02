import { AppState } from 'react-native';
import { getLocalDayCheckDelay, getLocalDaySnapshot } from '../utils/localDateSelection';

const listeners = new Set<() => void>();
let snapshot = getLocalDaySnapshot();
let timer: ReturnType<typeof setTimeout> | undefined;
let subscription: ReturnType<typeof AppState.addEventListener> | undefined;

export const getLocalDay = () => snapshot;

export const syncLocalDay = () => {
    const next = getLocalDaySnapshot();
    if (next !== snapshot) {
        snapshot = next;
        listeners.forEach(listener => listener());
    }
};

const stopTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
};

const checkAndSchedule = () => {
    stopTimer();
    syncLocalDay();
    if (listeners.size > 0 && (AppState.currentState === 'active' || AppState.currentState == null)) {
        timer = setTimeout(checkAndSchedule, getLocalDayCheckDelay());
    }
};

// All mounted tabs share one timer/listener, with no DB work on unchanged checks.
export const subscribeLocalDay = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
        subscription = AppState.addEventListener('change', state => {
            if (state === 'active') checkAndSchedule();
            else stopTimer();
        });
        checkAndSchedule();
    } else {
        syncLocalDay();
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            stopTimer();
            subscription?.remove();
            subscription = undefined;
        }
    };
};
