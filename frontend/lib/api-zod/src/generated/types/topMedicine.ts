import type { TopMedicineTrend } from './topMedicineTrend';

export interface TopMedicine {
  medicineId: number;
  medicineName: string;
  category?: string;
  count: number;
  revenue: number;
  trend?: TopMedicineTrend;
  percentChange?: number;
}
