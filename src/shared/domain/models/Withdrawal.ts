export interface Withdrawal {
    id: number;
    createdAt: number;
    amountCents: number;
    reason?: string;
}
