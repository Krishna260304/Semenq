import type { AiRecommendation } from './aiRecommendation';
import type { Order } from './order';
import type { Prescription } from './prescription';
import type { Reservation } from './reservation';

export interface PatientDashboard {
  pendingReservations: number;
  activeOrders: number;
  totalOrders: number;
  recentPrescriptions: Prescription[];
  upcomingReservations: Reservation[];
  recentOrders?: Order[];
  aiRecommendations: AiRecommendation[];
}
