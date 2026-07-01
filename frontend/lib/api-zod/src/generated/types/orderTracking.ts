import type { TrackingEvent } from './trackingEvent';

export interface OrderTracking {
  orderId: number;
  currentStatus: string;
  currentLat?: number | null;
  currentLng?: number | null;
  estimatedDelivery?: string;
  timeline: TrackingEvent[];
}
