/**
 * Salary calculations.
 * Salary rate is 0.5% of sales (daily or weekly).
 * All functions are pure and work with cents values.
 */

/** Rate: 0.5% = 0.005 */
const SALARY_RATE = 0.005;

/**
 * Calculate salary from a sales total in cents.
 * Returns the result rounded to the nearest integer (cents).
 */
export const calculateSalary = (salesCents: number): number => {
    return Math.round(salesCents * SALARY_RATE);
};

/**
 * Alias for clarity when computing daily salary.
 */
export const calculateDailySalary = calculateSalary;

/**
 * Alias for clarity when computing weekly salary.
 */
export const calculateWeeklySalary = calculateSalary;
