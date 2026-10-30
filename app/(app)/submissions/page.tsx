import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Placeholder } from "../_components/placeholder";

export const metadata: Metadata = { title: "Submissions" };

export default async function SubmissionsPage() {
  const user = await requireUser();
  const scope =
    user.role === "affiliate"
      ? `submissions from ${user.partnerName ?? "your partner"}`
      : user.role === "marketer"
        ? "your submissions"
        : "every submission";
  return (
    <Placeholder
      title={user.role === "marketer" || user.role === "affiliate" ? "My submissions" : "Submissions"}
      summary={`Will list ${scope} with status, risk, SLA and version, filterable, each linking to its review record and audit timeline.`}
    />
  );
}
