/**
 * BaseProvider — default stub behavior. Real processors override these methods
 * with live API calls; the rest of the app never changes.
 */

import type {
  PaymentProvider,
  CreateCustomerInput,
  AssignPlanInput,
  CreditOpInput,
  ValidatePurchaseInput,
  ValidatePurchaseResult,
} from "./types";

export abstract class BaseProvider implements PaymentProvider {
  abstract readonly name: string;

  async createCustomer(input: CreateCustomerInput): Promise<{ providerCustomerId: string }> {
    return { providerCustomerId: `${this.name}_${input.userId.slice(0, 8)}` };
  }

  async assignPlan(_input: AssignPlanInput): Promise<void> {
    // Stub: real providers would record the entitlement on their side.
  }

  async grantCredits(_input: CreditOpInput): Promise<void> {
    // Stub: ledger mutation happens in lib/billing/credits; provider is informational.
  }

  async refundCredits(_input: CreditOpInput): Promise<void> {
    // Stub.
  }

  async cancelSubscription(_input: { userId: string }): Promise<void> {
    // Stub.
  }

  async validatePurchase(input: ValidatePurchaseInput): Promise<ValidatePurchaseResult> {
    // Stub: accept a plan passed in the payload (no live verification yet).
    const plan = typeof input.payload.plan === "string" ? (input.payload.plan as ValidatePurchaseResult["plan"]) : undefined;
    return { valid: Boolean(plan), plan };
  }
}
