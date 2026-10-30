import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Placeholder } from "../_components/placeholder";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireRole("lead");
  return (
    <Placeholder
      title="Dashboard"
      summary="Will show throughput, cycle time, first-pass approval rate, SLA attainment, top issue categories and a partner scorecard."
    />
  );
}
