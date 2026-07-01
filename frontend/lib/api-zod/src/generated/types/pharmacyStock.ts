import type { PharmacyStockDeliveryType } from './pharmacyStockDeliveryType';
import type { PharmacyStockStockStatus } from './pharmacyStockStockStatus';

export interface PharmacyStock {
  pharmacyId: number;
  pharmacyName: string;
  quantity: number;
  price: number;
  distance: number;
  distanceUnit?: string;
  estimatedDelivery?: string;
  deliveryType?: PharmacyStockDeliveryType;
  lat?: number;
  lng?: number;
  stockStatus?: PharmacyStockStockStatus;
}
