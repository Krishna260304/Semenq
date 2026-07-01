import type { MapMarkerStockStatus } from './mapMarkerStockStatus';

export interface MapMarker {
  pharmacyId: number;
  pharmacyName: string;
  lat: number;
  lng: number;
  stockStatus: MapMarkerStockStatus;
  price?: number;
  quantity?: number;
}
