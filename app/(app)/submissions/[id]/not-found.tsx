import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function SubmissionNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-xl font-medium tracking-tight text-foreground">Submission not found</h1>
      <p className="text-sm text-muted">
        It may not exist, or it may belong to someone else. Submissions are visible only to their submitter, their partner organisation and compliance.
      </p>
      <Link href="/submissions" className={buttonVariants({ variant: "secondary" })}>
        Back to submissions
      </Link>
    </div>
  );
}
