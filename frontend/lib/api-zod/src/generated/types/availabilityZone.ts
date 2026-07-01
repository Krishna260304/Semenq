import type { AvailabilityZoneLevel } from './availabilityZoneLevel';
import type { PharmacyStock } from './pharmacyStock';

export interface AvailabilityZone {
  level: AvailabilityZoneLevel;
  label: string;
  pharmacyCount: number;
  minPrice: number;
  estimatedDelivery: string;
  pharmacies?: PharmacyStock[];
}
