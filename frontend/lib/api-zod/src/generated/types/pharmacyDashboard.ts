import type { Reservation } from './reservation';
import type { RevenueDataPoint } from './revenueDataPoint';
import type { TopMedicine } from './topMedicine';

export interface PharmacyDashboard {
  totalInventory: number;
  lowStockCount: number;
  outOfStockCount?: number;
  todayReservations: number;
  pendingReservations: number;
  confirmedReservations?: number;
  todayRevenue: number;
  monthlyRevenue: number;
  courierRequests: number;
  recentReservations?: Reservation[];
  topSellingMedicines?: TopMedicine[];
  revenueByDay?: RevenueDataPoint[];
}
