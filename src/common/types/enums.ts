export enum UserRole {
  ADMIN = 'ADMIN',
  CREATOR = 'CREATOR',
  STUDENT = 'STUDENT',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum CreditEventType {
  CHAT_QUERY = 'CHAT_QUERY',
  SUBSCRIPTION_GRANT = 'SUBSCRIPTION_GRANT',
  BONUS = 'BONUS',
  REFUND = 'REFUND',
}

export enum MessageSender {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}
