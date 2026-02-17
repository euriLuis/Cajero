export interface SaleItem {
    id: number;
    saleId: number;
    productId: number;
    productNameSnapshot: string;
    unitPriceSnapshotCents: number;
    qty: number;
    lineTotalCents: number;
}
