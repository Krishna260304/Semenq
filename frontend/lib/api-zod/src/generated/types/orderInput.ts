import type { OrderInputPaymentMethod } from './orderInputPaymentMethod';

export interface OrderInput {
  reservationId: number;
  paymentMethod: OrderInputPaymentMethod;
  deliveryAddress?: string | null;
}
