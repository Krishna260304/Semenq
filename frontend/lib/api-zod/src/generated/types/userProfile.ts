import type { UserProfileRole } from './userProfileRole';

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
