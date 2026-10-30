import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Placeholder } from "../_components/placeholder";

export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const user = await requireRole("reviewer", "lead");
  return (
    <Placeholder
      title="Rules library"
      summary={`Will list every compliance rule with its citation, severity and guidance. ${user.role === "lead" ? "As lead you can enable, disable and edit rules." : "Reviewers have read-only access; the compliance lead edits rules."}`}
    />
  );
}
