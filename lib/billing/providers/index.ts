/**
 * Provider registry. Swap or add a payment processor here — nothing else in the
 * app references a specific provider.
 */

import { BaseProvider } from "./base";
import { JVZooProvider } from "./jvzoo";
import { WarriorPlusProvider } from "./warriorplus";
import { StripeProvider } from "./stripe";
import { DodoProvider } from "./dodo";
import { LemonSqueezyProvider } from "./lemonsqueezy";
import type { PaymentProvider } from "./types";

class NoopProvider extends BaseProvider {
  readonly name = "none";
}

const REGISTRY: Record<string, PaymentProvider> = {
  none: new NoopProvider(),
  jvzoo: new JVZooProvider(),
  warriorplus: new WarriorPlusProvider(),
  stripe: new StripeProvider(),
  dodo: new DodoProvider(),
  lemonsqueezy: new LemonSqueezyProvider(),
};

export function getProvider(name: string | null | undefined): PaymentProvider {
  return REGISTRY[name ?? "none"] ?? REGISTRY.none;
}

export const PROVIDER_NAMES = Object.keys(REGISTRY);
export * from "./types";
