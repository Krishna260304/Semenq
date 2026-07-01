import type { ParsedMedicine } from './parsedMedicine';
import type { PrescriptionStatus } from './prescriptionStatus';

export interface Prescription {
  id: number;
  doctorName?: string | null;
  patientName?: string | null;
  hospitalName?: string | null;
  uploadedAt: string;
  status: PrescriptionStatus;
  imageUrl?: string | null;
  overallConfidence?: number;
  medicines: ParsedMedicine[];
  notes?: string | null;
}
