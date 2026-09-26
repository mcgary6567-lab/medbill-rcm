import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { auditEvents } from "@/server/compliance";
import { Card, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DataExportPage() {
  const s = await requireRole(["admin"]);
  const events = (await auditEvents(await getDb(), s.practiceId, { action: "export", limit: 200 })).filter((e) => e.event.entity === "practice").slice(0, 10);
  return (
    <>
      <PageHeader title="Data export" subtitle="Everything your practice has in CollaboratMD, in one download. Your data is yours to keep or take elsewhere." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Download" className="lg:col-span-3">
          <div className="space-y-3 text-sm text-slate-600">
            <p>A zip with one spreadsheet (CSV) per kind of record: patients, insurance, visits, charges, claims and their history, remittances, the ledger, denials, appointments, statements, payment plans, tasks, notes, settings and the audit log. Claim attachments are included as the original files.</p>
            <p>Passwords, second-factor secrets, API keys and connection tokens are left out. A README in the zip lists every file, the row counts and what was left out.</p>
            <p>The file contains protected health information. Store it somewhere encrypted and access-controlled. The download is recorded in the audit log.</p>
            <a href="/api/export/practice" className="btn btn-primary">Download everything</a>
            <p className="text-xs text-slate-500">Large practices can take a few minutes. Keep this tab open until the download finishes.</p>
          </div>
        </Card>
        <Card title="Recent full exports" className="lg:col-span-2">
          {events.length ? (
            <ul className="space-y-2 text-sm">
              {events.map(({ event, userName }) => <li key={event.id} className="flex justify-between gap-2"><span>{userName ?? "Someone"}</span><span className="text-slate-500">{fmtDateTime(event.at)}</span></li>)}
            </ul>
          ) : <p className="text-sm text-slate-500">No full exports yet.</p>}
        </Card>
      </div>
    </>
  );
}
