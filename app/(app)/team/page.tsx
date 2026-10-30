import { relativeTime } from "@/lib/time";
import type { Metadata } from "next";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { requireRoleOrNotFound } from "@/lib/auth";
import { listPendingInvites, listTeamMembers } from "@/lib/auth/invites";
import { roleLabel } from "@/lib/personas";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";
import { RevokeButton } from "./revoke-button";

export const metadata: Metadata = { title: "Team" };

const ABSOLUTE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const relative = (date: Date, now: number) => relativeTime(date, new Date(now));

function When({ date, now, mode = "relative" }: { date: Date; now: number; mode?: "relative" | "date" }) {
  return (
    <time dateTime={date.toISOString()} title={`${ABSOLUTE.format(date)} UTC`}>
      {mode === "date" ? DATE.format(date) : relative(date, now)}
    </time>
  );
}

const TH = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-subtle";
const TD = "px-4 py-3 align-top";

async function loadTeam() {
  await connection();
  const [members, invites, partners] = await Promise.all([
    listTeamMembers(),
    listPendingInvites(),
    db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners).orderBy(asc(tables.partners.name)),
  ]);
  // Relative times are rendered once on the server against this request's clock.
  return { members, invites, partners, now: Date.now() };
}

export default async function TeamPage() {
  const me = await requireRoleOrNotFound("lead");
  const { members, invites, partners, now } = await loadTeam();
  const realCount = members.filter((m) => !m.isDemo).length;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Team</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {members.length} people: {members.length - realCount} demo personas and {realCount} real {realCount === 1 ? "account" : "accounts"}. Marketers and
          affiliate partners can sign up themselves; reviewers and leads join only by invite.
        </p>
      </header>

      <section aria-labelledby="invite-heading" className="border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 id="invite-heading" className="text-base">
            Invite someone
          </h2>
          <p className="mt-1 text-sm text-muted">Creates a one-time sign-up link for one email address, valid for 7 days.</p>
        </div>
        <div className="px-5 py-5">
          {me.isDemo ? (
            <p role="note" className="mb-4 border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
              You are using a shared demo persona, so you can invite marketers and affiliates here but not reviewers or leads. A real lead account can invite staff.
            </p>
          ) : null}
          <InviteForm partners={partners} />
        </div>
      </section>

      <section aria-labelledby="pending-heading" className="space-y-3">
        <h2 id="pending-heading" className="text-lg">
          Pending invites <span className="text-sm text-subtle">({invites.length})</span>
        </h2>
        {invites.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-6 text-center text-sm text-muted">No pending invites. Links that were used or revoked are not listed.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className={TH}>Email</th>
                  <th scope="col" className={TH}>Role</th>
                  <th scope="col" className={TH}>Invited by</th>
                  <th scope="col" className={TH}>Expires</th>
                  <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-b-0">
                    <td className={`${TD} break-all text-foreground`}>{i.email}</td>
                    <td className={TD}>
                      {roleLabel(i.role)}
                      {i.partnerName ? <span className="block text-xs text-subtle">{i.partnerName}</span> : null}
                    </td>
                    <td className={`${TD} text-muted`}>
                      {i.inviterName ?? "Unknown"}
                      <span className="block text-xs text-subtle">
                        <When date={i.createdAt} now={now} />
                      </span>
                    </td>
                    <td className={`${TD} text-muted`}>
                      <When date={i.expiresAt} now={now} />
                    </td>
                    <td className={`${TD} text-right`}>
                      <RevokeButton inviteId={i.id} email={i.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-lg">
          Members <span className="text-sm text-subtle">({members.length})</span>
        </h2>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={TH}>Email</th>
                <th scope="col" className={TH}>Role</th>
                <th scope="col" className={TH}>Partner</th>
                <th scope="col" className={TH}>Created</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-b-0">
                  <td className={TD}>
                    <span className="flex flex-wrap items-center gap-2 text-foreground">
                      {m.name}
                      {m.isDemo ? (
                        <Badge variant="neutral" title="Seeded demo persona: passwordless, entered from the home page">
                          Demo
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${TD} break-all text-muted`}>{m.email}</td>
                  <td className={TD}>{roleLabel(m.role)}</td>
                  <td className={`${TD} text-muted`}>{m.partnerName ?? <span className="text-subtle">None</span>}</td>
                  <td className={`${TD} text-muted`}>
                    <When date={m.createdAt} now={now} mode="date" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
