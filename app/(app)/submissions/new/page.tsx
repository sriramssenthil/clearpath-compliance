import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Placeholder } from "../../_components/placeholder";

export const metadata: Metadata = { title: "New submission" };

export default async function NewSubmissionPage() {
  await requireRole("marketer", "affiliate");
  return (
    <Placeholder
      title="New submission"
      summary="Will take the asset text plus product, channel, states and launch date, run the automated pre-check, and show cited findings with suggested fixes before you submit."
    />
  );
}
