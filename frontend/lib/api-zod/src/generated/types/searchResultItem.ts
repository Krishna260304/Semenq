import type { Medicine } from './medicine';
import type { Pharmacy } from './pharmacy';
import type { SearchResultItemDeliveryType } from './searchResultItemDeliveryType';
import type { SearchResultItemStockStatus } from './searchResultItemStockStatus';

export interface SearchResultItem {
  medicine: Medicine;
  pharmacy: Pharmacy;
  price: number;
  quantity: number;
  distance: number;
  distanceUnit?: string;
  estimatedDelivery?: string;
  deliveryType: SearchResultItemDeliveryType;
  stockStatus: SearchResultItemStockStatus;
  matchScore?: number;
}
