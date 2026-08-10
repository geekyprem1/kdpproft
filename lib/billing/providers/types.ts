import type { PlanKey } from "../plans";

export interface CreateCustomerInput {
  userId: string;
  email?: string;
}
export interface AssignPlanInput {
  userId: string;
  plan: PlanKey;
  providerTransactionId?: string;
  providerCustomerId?: string;
}
export interface CreditOpInput {
  userId: string;
  amount: number;
  reason?: string;
}
export interface ValidatePurchaseInput {
  userId: string;
  payload: Record<string, unknown>;
}
export interface ValidatePurchaseResult {
  valid: boolean;
  plan?: PlanKey;
  providerTransactionId?: string;
  providerCustomerId?: string;
}

/**
 * The single boundary every payment processor must implement. Nothing outside
 * lib/billing/providers may import a processor SDK — credits, plans,
 * subscriptions, and usage tracking depend only on this interface.
 */
export interface PaymentProvider {
  readonly name: string;
  createCustomer(input: CreateCustomerInput): Promise<{ providerCustomerId: string }>;
  assignPlan(input: AssignPlanInput): Promise<void>;
  grantCredits(input: CreditOpInput): Promise<void>;
  refundCredits(input: CreditOpInput): Promise<void>;
  cancelSubscription(input: { userId: string }): Promise<void>;
  validatePurchase(input: ValidatePurchaseInput): Promise<ValidatePurchaseResult>;
}
