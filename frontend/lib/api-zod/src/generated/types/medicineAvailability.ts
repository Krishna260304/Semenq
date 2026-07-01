import type { AvailabilityZone } from './availabilityZone';

export interface MedicineAvailability {
  medicineId: number;
  zones: AvailabilityZone[];
}
