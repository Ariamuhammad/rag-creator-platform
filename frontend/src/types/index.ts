export type UserRole = 'ADMIN' | 'CREATOR' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  creatorProfile?: CreatorProfile;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  bio?: string;
  commissionRate: number; // e.g. 0.20
  walletBalance: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolderName?: string;
}

export interface SubscriptionTier {
  id: string;
  creatorProfileId: string;
  name: string;
  description?: string;
  price: number;
  monthlyCreditQuota: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  studentId: string;
  creatorProfileId: string;
  tierId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  remainingCredits: number;
  tier?: SubscriptionTier;
}

export interface ChatMessage {
  id: string;
  chatSessionId?: string;
  sender: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  retrievedContext?: {
    chunkId: string;
    similarity: number;
    text: string;
    documentTitle?: string;
  }[];
  createdAt: string;
}

export interface PaymentOrder {
  id: string;
  externalId: string;
  amount: number;
  platformFee: number;
  creatorEarnings: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  invoiceUrl?: string;
  paidAt?: string;
  createdAt: string;
  tier?: {
    name: string;
    price: number;
    monthlyCreditQuota: number;
  };
}

export interface PayoutRequest {
  id: string;
  creatorProfileId: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolderName: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  creatorProfileId: string;
  courseId?: string | null;
  course?: {
    id: string;
    title: string;
    slug: string;
  };
  title: string;
  fileType: string;
  fileSize: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  createdAt: string;
}
