"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
} from "@/lib/api/campaigns";
import { senderList } from "@/lib/campaign/helpers";
import type { Campaign } from "@/lib/types/campaign";

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setCampaigns(await listCampaigns());
    } catch {
      // interceptor
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return campaigns;
    }
    return campaigns.filter((campaign) =>
      campaign.name.toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Outreach
          </p>
          <h1 className="font-heading mt-2 text-4xl">Campaigns</h1>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Create campaign
        </Button>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Input
          className="max-w-sm"
          placeholder="Search campaigns"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Leads completed</th>
              <th className="px-4 py-3 font-medium">Sender</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((campaign) => {
              const senders = senderList(campaign);
              const canToggle =
                campaign.status === "active" || campaign.status === "paused";
              return (
                <tr key={campaign._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Switch
                      checked={campaign.status === "active"}
                      disabled={!canToggle}
                      onCheckedChange={async (on) => {
                        try {
                          if (on) {
                            await resumeCampaign(campaign._id);
                          } else {
                            await pauseCampaign(campaign._id);
                          }
                          load();
                        } catch {
                          // interceptor
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/campaigns/${campaign._id}`}
                      className="font-medium hover:text-primary"
                    >
                      {campaign.name}
                    </Link>
                    <p className="text-xs capitalize text-muted-foreground">
                      {campaign.status}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {campaign.stats?.completed ?? 0}/{campaign.stats?.total ?? 0}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {senders[0]?.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(campaign.createdAt), {
                      addSuffix: true,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            No campaigns yet. Create one to build a sequence.
          </p>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create campaign</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Campaign name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              disabled={creating || !name.trim()}
              onClick={async () => {
                setCreating(true);
                try {
                  const campaign = await createCampaign({
                    name: name.trim(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  });
                  toast.success("Campaign created");
                  setName("");
                  setOpen(false);
                  router.push(`/dashboard/campaigns/${campaign._id}`);
                } catch {
                  // interceptor
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
