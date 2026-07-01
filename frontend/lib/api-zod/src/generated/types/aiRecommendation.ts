import type { AiRecommendationType } from './aiRecommendationType';

export interface AiRecommendation {
  id: number;
  type: AiRecommendationType;
  title: string;
  description: string;
  medicineId?: number | null;
  medicineName?: string | null;
  actionLabel?: string | null;
}
