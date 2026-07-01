import type { ActivityEvent } from './activityEvent';
import type { PlatformHealth } from './platformHealth';
import type { RevenueDataPoint } from './revenueDataPoint';

export interface AdminDashboard {
  totalUsers: number;
  totalPharmacies: number;
  totalMedicines: number;
  totalOrders: number;
  monthlyRevenue: number;
  activeReservations?: number;
  pendingVerifications?: number;
  platformHealth: PlatformHealth;
  recentActivity?: ActivityEvent[];
  userGrowth?: RevenueDataPoint[];
}
