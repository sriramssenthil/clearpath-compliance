import type { Channel, Product } from "@/lib/compliance/types";

export const PRODUCT_LABEL: Record<Product, string> = {
  personal_loan: "Personal loan",
  credit_card: "Credit card",
  mortgage_prequal: "Mortgage prequalification",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  social: "Paid social",
  display: "Display ad",
  affiliate_page: "Affiliate landing page",
  sms: "SMS",
};

export const MAX_CONTENT = 30_000;
export const MIN_CONTENT = 20;
