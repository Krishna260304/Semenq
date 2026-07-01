
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
