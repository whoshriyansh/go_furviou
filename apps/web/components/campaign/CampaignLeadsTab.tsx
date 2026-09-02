"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { listCampaignLeads } from "@/lib/api/campaigns";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import {
  avatarColor,
  enrollmentLabel,
  formatInCampaignZone,
  initials,
  leadName,
} from "@/lib/campaign/helpers";
import type { Campaign } from "@/lib/types/campaign";
import type { Lead } from "@/lib/types/lead";
import { getStoredUser } from "@/lib/api/auth";

export function CampaignLeadsTab({
  campaign,
  onChanged,
}: {
  campaign: Campaign;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const owner = getStoredUser();
  const limit = 50;

  async function load(nextPage = page, nextQ = search) {
    setLoading(true);
    try {
      const data = await listCampaignLeads(campaign._id, {
        page: nextPage,
        limit,
        q: nextQ || undefined,
      });
      setRows(data.leads);
      setTotal(data.total);
      setPage(data.page);
    } catch {
      // interceptor
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign._id, search, campaign.sending?.nextLeadAt, campaign.stats?.sent]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <Input
          className="max-w-sm"
          placeholder="Search by email, last name, first name"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setSearch(q.trim());
            }
          }}
        />
        <Button variant="outline" onClick={() => setSearch(q.trim())}>
          Search
        </Button>
        <div className="ml-auto">
          <Button onClick={() => setImportOpen(true)}>+ Import leads</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!loading && total === 0 && !search ? (
          <div className="flex h-full items-center justify-center p-8">
            <Empty className="max-w-md border border-dashed bg-card">
              <EmptyHeader>
                <EmptyTitle>You don&apos;t have any leads</EmptyTitle>
                <EmptyDescription>
                  Import a CSV with an email column. Map extra columns like city
                  or company to personalize the sequence.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setImportOpen(true)}>
                  + Import new leads
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Next send</th>
                <th className="px-4 py-2 font-medium">Issue</th>
                <th className="px-4 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const name = leadName(lead);
                return (
                  <tr key={lead._id} className="border-b border-border">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: avatarColor(name) }}
                        >
                          {initials(name)}
                        </span>
                        <span className="truncate">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {lead.email}
                    </td>
                    <td className="px-4 py-2">{lead.company || "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary">
                        {enrollmentLabel(lead.enrollmentStatus)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatInCampaignZone(lead.nextSendAt, campaign.timezone)}
                    </td>
                    <td className={`max-w-56 truncate px-4 py-2 text-xs ${lead.lastError ? "text-destructive" : "text-muted-foreground"}`}>
                      {lead.lastError || "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {owner?.displayName || owner?.email || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          {total
            ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`
            : "0 of 0"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="xs"
            disabled={page <= 1}
            onClick={() => load(page - 1, search)}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={page >= pages}
            onClick={() => load(page + 1, search)}
          >
            Next
          </Button>
        </div>
      </div>

      <ImportLeadsDialog
        open={importOpen}
        campaignId={campaign._id}
        onOpenChange={setImportOpen}
        onImported={() => {
          load(1, search);
          onChanged();
        }}
      />
    </div>
  );
}
