import type { DemandForecastItemHealthStatus } from './demandForecastItemHealthStatus';
import type { DemandForecastItemTrend } from './demandForecastItemTrend';

export interface DemandForecastItem {
  medicineId: number;
  medicineName: string;
  genericName?: string;
  currentStock: number;
  predictedDemand: number;
  reorderSuggestion: number;
  confidence: number;
  trend: DemandForecastItemTrend;
  healthStatus?: DemandForecastItemHealthStatus;
  aiInsight?: string;
  daysUntilStockout?: number | null;
}
