import type { OrderDeliveryType } from './orderDeliveryType';
import type { OrderPaymentStatus } from './orderPaymentStatus';
import type { OrderStatus } from './orderStatus';

export interface Order {
  id: number;
  reservationId: number;
  medicineName?: string;
  pharmacyName?: string;
  status: OrderStatus;
  deliveryType?: OrderDeliveryType;
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus?: OrderPaymentStatus;
  deliveryAddress?: string | null;
  trackingId?: string | null;
  estimatedDelivery?: string | null;
  createdAt: string;
  updatedAt?: string;
}
