"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  checkAllMailboxes,
  checkMailbox,
  listMailboxes,
  removeMailbox,
  startGmailConnect,
} from "@/lib/api/mailbox";
import type { Mailbox } from "@/lib/types/mailbox";

function statusLabel(box: Mailbox) {
  if (box.status === "connected" && box.hasRefreshToken !== false) {
    return "Connected";
  }
  if (box.status === "paused") {
    return "Paused";
  }
  if (box.status === "error") {
    return "Error";
  }
  return "Needs reconnect";
}

function MailboxPageInner() {
  const searchParams = useSearchParams();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

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
        Access tokens expire about every hour. A refresh token keeps the mailbox
        connected until you revoke it in Google or we mark it as needs reconnect.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
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
          disabled={checking || mailboxes.length === 0}
          onClick={async () => {
            setChecking(true);
            try {
              const rows = await checkAllMailboxes();
              setMailboxes(rows);
              const bad = rows.filter(
                (box) => !(box.status === "connected" && box.hasRefreshToken),
              ).length;
              toast.success(
                bad
                  ? `${rows.length - bad} connected, ${bad} need reconnect`
                  : "All mailboxes can send",
              );
            } catch {
              // interceptor
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? "Checking…" : "Check connections"}
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
        {mailboxes.map((box) => {
          const healthy = box.status === "connected" && box.hasRefreshToken !== false;
          return (
            <div
              key={box._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{box.email}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={healthy ? "secondary" : "destructive"}>
                    {statusLabel(box)}
                  </Badge>
                  <span>{box.provider}</span>
                  {box.hasRefreshToken ? (
                    <span>Refresh token saved</span>
                  ) : (
                    <span>No refresh token</span>
                  )}
                  {box.tokenExpiresAt ? (
                    <span>
                      Access expires{" "}
                      {new Date(box.tokenExpiresAt).toLocaleTimeString()}
                    </span>
                  ) : null}
                </p>
                {box.lastCheckMessage ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {box.lastCheckMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {!healthy ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      startGmailConnect().catch(() => undefined);
                    }}
                  >
                    Reconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const next = await checkMailbox(box._id);
                        setMailboxes((current) =>
                          current.map((item) =>
                            item._id === next._id ? next : item,
                          ),
                        );
                        toast.success(next.lastCheckMessage || "Mailbox is ready");
                      } catch {
                        // interceptor
                      }
                    }}
                  >
                    Check
                  </Button>
                )}
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
            </div>
          );
        })}
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
