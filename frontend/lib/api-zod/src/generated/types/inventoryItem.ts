import type { InventoryItemStockStatus } from './inventoryItemStockStatus';

export interface InventoryItem {
  id: number;
  medicineId: number;
  medicineName: string;
  genericName?: string;
  quantity: number;
  price: number;
  mrp?: number;
  expiryDate: string;
  batchNumber?: string;
  stockStatus: InventoryItemStockStatus;
  reorderLevel?: number;
  lastRestocked?: string;
}
