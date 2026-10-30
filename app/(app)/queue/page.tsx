import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Placeholder } from "../_components/placeholder";

export const metadata: Metadata = { title: "Review queue" };

export default async function QueuePage() {
  await requireRole("reviewer", "lead");
  return (
    <Placeholder
      title="Review queue"
      summary="Will list submissions awaiting review, sorted by SLA and risk, with a fast lane for low-risk items and one-click claim."
    />
  );
}
