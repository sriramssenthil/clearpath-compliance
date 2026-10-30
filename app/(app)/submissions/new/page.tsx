import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { NewSubmissionForm } from "@/components/submit/new-submission-form";
import { currentActor } from "@/lib/workflow/action-helpers";
import { listSubmissions } from "@/lib/workflow/queries";

// Server actions on this page call the model (5-15 s); allow headroom beyond the host default.
export const maxDuration = 60;

export const metadata: Metadata = { title: "New submission" };

export default async function NewSubmissionPage() {
  const user = await requireRole("marketer", "affiliate");
  const masters = (await listSubmissions(await currentActor()))
    .filter((s) => s.status === "approved")
    .map((s) => ({ id: s.id, code: s.code, title: s.title, product: s.product }));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">New submission</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Describe the asset, paste its text and run the pre-check. You will see what compliance would flag, with the exact text and a suggested fix, so you
          can correct it before anyone reviews it.
        </p>
      </header>
      <NewSubmissionForm userId={user.id} role={user.role} masters={masters} />
    </div>
  );
}
