export const parseMoneyToCents = (input: string): number => {
    // Remove currency symbol and whitespace
    let clean = input.replace(/[$ ]/g, '');
    // Replace comma with dot
    clean = clean.replace(',', '.');

    const value = parseFloat(clean);
    if (isNaN(value)) {
        return 0;
    }

    // Round to 2 decimal places and multiply by 100
    // Using Math.round to avoid floating point precision issues
    return Math.round(value * 100);
};

export const formatCents = (cents: number): string => {
    const value = cents / 100;
    const formatted = value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${formatted}`;
};
