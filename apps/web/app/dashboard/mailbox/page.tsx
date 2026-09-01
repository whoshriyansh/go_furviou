"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listMailboxes,
  removeMailbox,
  startGmailConnect,
} from "@/lib/api/mailbox";
import type { Mailbox } from "@/lib/types/mailbox";

function MailboxPageInner() {
  const searchParams = useSearchParams();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const rows = await listMailboxes();
      setMailboxes(rows);
    } catch {
      // interceptor toasts
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const result = searchParams.get("gmail");
    if (result === "connected") {
      toast.success("Gmail connected");
    } else if (result === "denied") {
      toast.error("Gmail access was denied");
    } else if (result === "error") {
      toast.error("Could not connect Gmail");
    }
    load();
  }, [searchParams]);

  return (
    <section>
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Sending
      </p>
      <h1 className="font-heading mt-2 text-4xl">Mailbox</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Login only stores your name and email. Connecting a mailbox is a
        separate Google consent for send and read.
      </p>

      <div className="mt-8 flex gap-3">
        <Button
          onClick={() => {
            startGmailConnect().catch((error) =>
              console.error("[mailbox] gmail connect", error),
            );
          }}
        >
          Connect Gmail
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.message("Outlook connect is next")}
        >
          Connect Outlook
        </Button>
      </div>

      <div className="mt-10 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && mailboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mailboxes yet.</p>
        ) : null}
        {mailboxes.map((box) => (
          <div
            key={box._id}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="font-medium">{box.email}</p>
              <p className="text-xs text-muted-foreground">
                {box.provider} · {box.status}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await removeMailbox(box._id);
                toast.success("Mailbox removed");
                load();
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MailboxPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <MailboxPageInner />
    </Suspense>
  );
}
