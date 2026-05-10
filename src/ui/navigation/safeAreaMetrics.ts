import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const FLOATING_TAB_BAR_HEIGHT = 66;
export const MIN_BOTTOM_SYSTEM_GAP = 10;
export const TAB_BAR_CONTENT_GAP = 14;

export const getBottomSystemGap = (bottomInset: number) => Math.max(bottomInset, MIN_BOTTOM_SYSTEM_GAP);

export const getFloatingTabBarClearance = (bottomInset: number) =>
    FLOATING_TAB_BAR_HEIGHT + getBottomSystemGap(bottomInset) + TAB_BAR_CONTENT_GAP;

export const useFloatingTabBarClearance = (extra = 0) => {
    const insets = useSafeAreaInsets();
    return getFloatingTabBarClearance(insets.bottom) + extra;
};
