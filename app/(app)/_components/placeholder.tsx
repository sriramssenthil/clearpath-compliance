import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";

/** Stand-in used by routes whose real page has not landed yet. */
export function Placeholder({ title, summary, children }: { title: string; summary: string; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{summary}</p>
      </header>
      <Card>
        <CardBody className="text-sm text-muted">{children ?? "This view is being built."}</CardBody>
      </Card>
    </div>
  );
}
