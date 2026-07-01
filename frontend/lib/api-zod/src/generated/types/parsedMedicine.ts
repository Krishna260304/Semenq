import type { ParsedMedicineStatus } from './parsedMedicineStatus';

export interface ParsedMedicine {
  id: number;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  confidence: number;
  matchedMedicineId?: number | null;
  status?: ParsedMedicineStatus;
}
