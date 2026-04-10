/**
 * Cart / Sale calculations.
 * All functions are pure.
 */

export interface CartItem {
    productId: number;
    productNameSnapshot: string;
    unitPriceSnapshotCents: number;
    qty: number;
}

/**
 * Calculate the total in cents of all items in the cart.
 */
export const calculateCartTotal = (cart: CartItem[]): number => {
    return cart.reduce((sum, item) => sum + item.unitPriceSnapshotCents * item.qty, 0);
};

/**
 * Add or merge a product into the cart.
 * If the product already exists, quantities are summed.
 */
export const addToCart = (
    cart: CartItem[],
    product: Omit<CartItem, 'qty'> & { qty: number },
): CartItem[] => {
    const existing = cart.find(item => item.productId === product.productId);
    if (existing) {
        return cart.map(item =>
            item.productId === product.productId
                ? { ...item, qty: item.qty + product.qty }
                : item
        );
    }
    return [...cart, product];
};

/**
 * Update the quantity of a cart item by a delta.
 * Items whose quantity drops to <= 0 are removed.
 */
export const updateCartQty = (cart: CartItem[], productId: number, delta: number): CartItem[] => {
    return cart
        .map(item => {
            if (item.productId === productId) {
                const newQty = item.qty + delta;
                return newQty > 0 ? { ...item, qty: newQty } : item;
            }
            return item;
        })
        .filter(item => item.qty > 0);
};

/**
 * Remove a product from the cart by its ID.
 */
export const removeFromCart = (cart: CartItem[], productId: number): CartItem[] => {
    return cart.filter(item => item.productId !== productId);
};

/**
 * Combine a selected date with the current time.
 * Uses the date portion from `selectedDate` and the time portion from `now`.
 */
export const combineDateWithCurrentTime = (selectedDate: Date, now: Date = new Date()): Date => {
    const combined = new Date(selectedDate);
    combined.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return combined;
};
