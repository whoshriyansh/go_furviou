"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listLeads } from "@/lib/api/leads";
import {
  avatarColor,
  initials,
  leadName,
} from "@/lib/campaign/helpers";
import type { Lead } from "@/lib/types/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 50;

  async function load(nextPage = page, nextQ = search) {
    setLoading(true);
    try {
      const data = await listLeads({
        page: nextPage,
        limit,
        q: nextQ || undefined,
      });
      setLeads(data.leads);
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
  }, [search]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <section>
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Contacts
      </p>
      <h1 className="font-heading mt-2 text-4xl">Leads</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everyone you imported. Open a campaign to add more from CSV.
      </p>

      <div className="mt-6 flex gap-2">
        <Input
          className="max-w-sm"
          placeholder="Search email, name, company, city"
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
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Campaigns</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const name = leadName(lead);
              return (
                <tr key={lead._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: avatarColor(name) }}
                      >
                        {initials(name)}
                      </span>
                      {name}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{lead.email}</td>
                  <td className="px-4 py-2">{lead.company || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {[lead.city, lead.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    {lead.campaigns?.length
                      ? lead.campaigns.map((campaign) => (
                          <Link
                            key={campaign.id}
                            href={`/dashboard/campaigns/${campaign.id}`}
                            className="mr-2 text-primary"
                          >
                            {campaign.name}
                          </Link>
                        ))
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {!loading && leads.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No leads yet.</p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
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
    </section>
  );
}
