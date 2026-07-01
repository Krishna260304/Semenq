
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];


export const NotificationType = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  aiInsight: 'aiInsight',
} as const;
