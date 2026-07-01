export interface HealthStatus {
  status: string;
}

export interface Medicine {
  id: number;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  composition?: string;
  dosage?: string;
  price: number;
  mrp?: number;
  imageUrl: string;
  requiresPrescription?: boolean;
  description?: string | null;
  sideEffects?: string | null;
  storageConditions?: string | null;
}

export interface MedicineList {
  items: Medicine[];
  total: number;
  page: number;
  limit: number;
}

export type AvailabilityZoneLevel = typeof AvailabilityZoneLevel[keyof typeof AvailabilityZoneLevel];


export const AvailabilityZoneLevel = {
  nearby: 'nearby',
  city: 'city',
  district: 'district',
  state: 'state',
  national: 'national',
} as const;

export type PharmacyStockDeliveryType = typeof PharmacyStockDeliveryType[keyof typeof PharmacyStockDeliveryType];


export const PharmacyStockDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;

export type PharmacyStockStockStatus = typeof PharmacyStockStockStatus[keyof typeof PharmacyStockStockStatus];


export const PharmacyStockStockStatus = {
  available: 'available',
  limited: 'limited',
  outOfStock: 'outOfStock',
} as const;

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

export interface AvailabilityZone {
  level: AvailabilityZoneLevel;
  label: string;
  pharmacyCount: number;
  minPrice: number;
  estimatedDelivery: string;
  pharmacies?: PharmacyStock[];
}

export interface MedicineAvailability {
  medicineId: number;
  zones: AvailabilityZone[];
}

export interface Pharmacy {
  id: number;
  name: string;
  ownerName?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  phone: string;
  email?: string | null;
  lat?: number;
  lng?: number;
  isVerified: boolean;
  rating: number;
  reviewCount?: number;
  openTime?: string;
  closeTime?: string;
  offersCourier?: boolean;
  licenseNumber?: string;
  totalInventory?: number;
}

export type InventoryItemStockStatus = typeof InventoryItemStockStatus[keyof typeof InventoryItemStockStatus];


export const InventoryItemStockStatus = {
  inStock: 'inStock',
  lowStock: 'lowStock',
  outOfStock: 'outOfStock',
} as const;

export interface InventoryItem {
  id: number;
  medicineId: number;
  medicineName: string;
  genericName?: string;
  quantity: number;
  price: number;
  mrp?: number;
  expiryDate: string;
  batchNumber?: string;
  stockStatus: InventoryItemStockStatus;
  reorderLevel?: number;
  lastRestocked?: string;
}

export interface InventoryUpdate {
  quantity?: number;
  price?: number;
  expiryDate?: string;
  reorderLevel?: number;
}

export type PrescriptionStatus = typeof PrescriptionStatus[keyof typeof PrescriptionStatus];


export const PrescriptionStatus = {
  processing: 'processing',
  parsed: 'parsed',
  failed: 'failed',
} as const;

export type ParsedMedicineStatus = typeof ParsedMedicineStatus[keyof typeof ParsedMedicineStatus];


export const ParsedMedicineStatus = {
  confirmed: 'confirmed',
  lowConfidence: 'lowConfidence',
  unmatched: 'unmatched',
} as const;

export interface ParsedMedicine {
  id: number;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  confidence: number;
  matchedMedicineId?: number | null;
  status?: ParsedMedicineStatus;
}

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

export interface PrescriptionInput {
  imageBase64: string;
  mimeType?: string;
}

export type ReservationStatus = typeof ReservationStatus[keyof typeof ReservationStatus];


export const ReservationStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  ready: 'ready',
  cancelled: 'cancelled',
  expired: 'expired',
} as const;

export type ReservationDeliveryType = typeof ReservationDeliveryType[keyof typeof ReservationDeliveryType];


export const ReservationDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;

export interface Reservation {
  id: number;
  medicineId: number;
  medicineName: string;
  pharmacyId: number;
  pharmacyName: string;
  quantity: number;
  price?: number;
  totalAmount?: number;
  status: ReservationStatus;
  deliveryType?: ReservationDeliveryType;
  expiresAt: string;
  createdAt: string;
  prescriptionId?: number | null;
  qrCode?: string | null;
  notes?: string | null;
}

export type ReservationInputDeliveryType = typeof ReservationInputDeliveryType[keyof typeof ReservationInputDeliveryType];


export const ReservationInputDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;

export interface ReservationInput {
  medicineId: number;
  pharmacyId: number;
  quantity: number;
  deliveryType: ReservationInputDeliveryType;
  prescriptionId?: number | null;
  notes?: string | null;
}

export type ReservationUpdateStatus = typeof ReservationUpdateStatus[keyof typeof ReservationUpdateStatus];


export const ReservationUpdateStatus = {
  confirmed: 'confirmed',
  ready: 'ready',
  cancelled: 'cancelled',
} as const;

export interface ReservationUpdate {
  status?: ReservationUpdateStatus;
  notes?: string;
}

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];


export const OrderStatus = {
  placed: 'placed',
  processing: 'processing',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const;

export type OrderDeliveryType = typeof OrderDeliveryType[keyof typeof OrderDeliveryType];


export const OrderDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;

export type OrderPaymentStatus = typeof OrderPaymentStatus[keyof typeof OrderPaymentStatus];


export const OrderPaymentStatus = {
  pending: 'pending',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
} as const;

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

export type OrderInputPaymentMethod = typeof OrderInputPaymentMethod[keyof typeof OrderInputPaymentMethod];


export const OrderInputPaymentMethod = {
  upi: 'upi',
  card: 'card',
  netBanking: 'netBanking',
  wallet: 'wallet',
} as const;

export interface OrderInput {
  reservationId: number;
  paymentMethod: OrderInputPaymentMethod;
  deliveryAddress?: string | null;
}

export interface TrackingEvent {
  stage: string;
  label: string;
  description?: string;
  timestamp: string | null;
  completed: boolean;
}

export interface OrderTracking {
  orderId: number;
  currentStatus: string;
  currentLat?: number | null;
  currentLng?: number | null;
  estimatedDelivery?: string;
  timeline: TrackingEvent[];
}

export type UserProfileRole = typeof UserProfileRole[keyof typeof UserProfileRole];


export const UserProfileRole = {
  patient: 'patient',
  pharmacy: 'pharmacy',
  admin: 'admin',
} as const;

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserProfileRole;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  createdAt?: string;
}

export interface UserProfileUpdate {
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
}

export type AiRecommendationType = typeof AiRecommendationType[keyof typeof AiRecommendationType];


export const AiRecommendationType = {
  refill: 'refill',
  alternative: 'alternative',
  saving: 'saving',
  alert: 'alert',
} as const;

export interface AiRecommendation {
  id: number;
  type: AiRecommendationType;
  title: string;
  description: string;
  medicineId?: number | null;
  medicineName?: string | null;
  actionLabel?: string | null;
}

export interface PatientDashboard {
  pendingReservations: number;
  activeOrders: number;
  totalOrders: number;
  recentPrescriptions: Prescription[];
  upcomingReservations: Reservation[];
  recentOrders?: Order[];
  aiRecommendations: AiRecommendation[];
}

export type TopMedicineTrend = typeof TopMedicineTrend[keyof typeof TopMedicineTrend];


export const TopMedicineTrend = {
  up: 'up',
  down: 'down',
  stable: 'stable',
} as const;

export interface TopMedicine {
  medicineId: number;
  medicineName: string;
  category?: string;
  count: number;
  revenue: number;
  trend?: TopMedicineTrend;
  percentChange?: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface PharmacyDashboard {
  totalInventory: number;
  lowStockCount: number;
  outOfStockCount?: number;
  todayReservations: number;
  pendingReservations: number;
  confirmedReservations?: number;
  todayRevenue: number;
  monthlyRevenue: number;
  courierRequests: number;
  recentReservations?: Reservation[];
  topSellingMedicines?: TopMedicine[];
  revenueByDay?: RevenueDataPoint[];
}

export type PlatformHealthServerStatus = typeof PlatformHealthServerStatus[keyof typeof PlatformHealthServerStatus];


export const PlatformHealthServerStatus = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
} as const;

export type PlatformHealthDbStatus = typeof PlatformHealthDbStatus[keyof typeof PlatformHealthDbStatus];


export const PlatformHealthDbStatus = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
} as const;

export type PlatformHealthApiStatus = typeof PlatformHealthApiStatus[keyof typeof PlatformHealthApiStatus];


export const PlatformHealthApiStatus = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
} as const;

export interface PlatformHealth {
  serverStatus: PlatformHealthServerStatus;
  dbStatus: PlatformHealthDbStatus;
  apiStatus: PlatformHealthApiStatus;
  apiResponseTime: number;
  uptime: number;
  errorRate?: number;
}

export type ActivityEventType = typeof ActivityEventType[keyof typeof ActivityEventType];


export const ActivityEventType = {
  userRegistered: 'userRegistered',
  pharmacyVerified: 'pharmacyVerified',
  orderPlaced: 'orderPlaced',
  paymentReceived: 'paymentReceived',
  alert: 'alert',
} as const;

export interface ActivityEvent {
  id: number;
  type: ActivityEventType;
  description: string;
  timestamp: string;
  metadata?: string;
}

export interface AdminDashboard {
  totalUsers: number;
  totalPharmacies: number;
  totalMedicines: number;
  totalOrders: number;
  monthlyRevenue: number;
  activeReservations?: number;
  pendingVerifications?: number;
  platformHealth: PlatformHealth;
  recentActivity?: ActivityEvent[];
  userGrowth?: RevenueDataPoint[];
}

export type DemandForecastItemTrend = typeof DemandForecastItemTrend[keyof typeof DemandForecastItemTrend];


export const DemandForecastItemTrend = {
  rising: 'rising',
  stable: 'stable',
  falling: 'falling',
} as const;

export type DemandForecastItemHealthStatus = typeof DemandForecastItemHealthStatus[keyof typeof DemandForecastItemHealthStatus];


export const DemandForecastItemHealthStatus = {
  healthy: 'healthy',
  warning: 'warning',
  critical: 'critical',
} as const;

export interface DemandForecastItem {
  medicineId: number;
  medicineName: string;
  genericName?: string;
  currentStock: number;
  predictedDemand: number;
  reorderSuggestion: number;
  confidence: number;
  trend: DemandForecastItemTrend;
  healthStatus?: DemandForecastItemHealthStatus;
  aiInsight?: string;
  daysUntilStockout?: number | null;
}

export type MedicineSearchResultExpansionLevel = typeof MedicineSearchResultExpansionLevel[keyof typeof MedicineSearchResultExpansionLevel];


export const MedicineSearchResultExpansionLevel = {
  nearby: 'nearby',
  city: 'city',
  district: 'district',
  state: 'state',
  national: 'national',
} as const;

export type SearchResultItemDeliveryType = typeof SearchResultItemDeliveryType[keyof typeof SearchResultItemDeliveryType];


export const SearchResultItemDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;

export type SearchResultItemStockStatus = typeof SearchResultItemStockStatus[keyof typeof SearchResultItemStockStatus];


export const SearchResultItemStockStatus = {
  available: 'available',
  limited: 'limited',
  outOfStock: 'outOfStock',
} as const;

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

export type MapMarkerStockStatus = typeof MapMarkerStockStatus[keyof typeof MapMarkerStockStatus];


export const MapMarkerStockStatus = {
  available: 'available',
  limited: 'limited',
  outOfStock: 'outOfStock',
  courier: 'courier',
} as const;

export interface MapMarker {
  pharmacyId: number;
  pharmacyName: string;
  lat: number;
  lng: number;
  stockStatus: MapMarkerStockStatus;
  price?: number;
  quantity?: number;
}

export interface MedicineSearchResult {
  query: string;
  totalResults: number;
  searchRadius: number;
  expansionLevel: MedicineSearchResultExpansionLevel;
  results: SearchResultItem[];
  mapMarkers?: MapMarker[];
}

export type SearchSuggestionType = typeof SearchSuggestionType[keyof typeof SearchSuggestionType];


export const SearchSuggestionType = {
  medicine: 'medicine',
  generic: 'generic',
  brand: 'brand',
  category: 'category',
} as const;

export interface SearchSuggestion {
  text: string;
  type: SearchSuggestionType;
  medicineId?: number | null;
  category?: string | null;
}

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];


export const NotificationType = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  aiInsight: 'aiInsight',
} as const;

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  relatedId?: number | null;
  relatedType?: string | null;
}

export type ListMedicinesParams = {
query?: string;
category?: string;
page?: number;
limit?: number;
};

export type ListPharmaciesParams = {
city?: string;
state?: string;
lat?: number;
lng?: number;
radius?: number;
};

export type ListReservationsParams = {
status?: ListReservationsStatus;
pharmacyId?: number;
};

export type ListReservationsStatus = typeof ListReservationsStatus[keyof typeof ListReservationsStatus];


export const ListReservationsStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  ready: 'ready',
  cancelled: 'cancelled',
  expired: 'expired',
} as const;

export type ListOrdersParams = {
status?: ListOrdersStatus;
};

export type ListOrdersStatus = typeof ListOrdersStatus[keyof typeof ListOrdersStatus];


export const ListOrdersStatus = {
  placed: 'placed',
  processing: 'processing',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const;

export type SearchMedicinesParams = {
q: string;
lat?: number;
lng?: number;
radius?: number;
sortBy?: SearchMedicinesSortBy;
};

export type SearchMedicinesSortBy = typeof SearchMedicinesSortBy[keyof typeof SearchMedicinesSortBy];


export const SearchMedicinesSortBy = {
  nearest: 'nearest',
  fastest: 'fastest',
  cheapest: 'cheapest',
  bestMatch: 'bestMatch',
} as const;

export type GetSearchSuggestionsParams = {
q: string;
};

export type GetDemandForecastParams = {
days?: number;
};

export type GetTopMedicinesParams = {
limit?: number;
};

export type ListNotificationsParams = {
unreadOnly?: boolean;
};

