import type { ActivityEventType } from './activityEventType';

export interface ActivityEvent {
  id: number;
  type: ActivityEventType;
  description: string;
  timestamp: string;
  metadata?: string;
}
