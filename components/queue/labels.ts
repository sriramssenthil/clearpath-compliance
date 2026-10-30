import type { Channel, Product } from "@/lib/compliance/types";

export const PRODUCT_LABEL: Record<Product, string> = {
  personal_loan: "Personal loan",
  credit_card: "Credit card",
  mortgage_prequal: "Mortgage prequal",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  social: "Social",
  display: "Display",
  affiliate_page: "Affiliate page",
  sms: "SMS",
};

export const RISK_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;
