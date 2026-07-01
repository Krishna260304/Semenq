import type { NotificationType } from './notificationType';

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
