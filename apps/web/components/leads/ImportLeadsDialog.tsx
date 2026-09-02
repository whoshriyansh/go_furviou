"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { LEAD_FIELDS, suggestLeadField, type LeadFieldKey } from "@furviou/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { importCampaignLeads } from "@/lib/api/campaigns";
import { importLeads } from "@/lib/api/leads";

type Mapping = Record<string, LeadFieldKey | "skip">;

type ImportResult = {
  imported: number;
  updated: number;
  enrolled?: number;
  alreadyEnrolled?: number;
  skippedNoEmail: number;
  skippedInvalid: number;
};

export function ImportLeadsDialog({
  open,
  campaignId,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  campaignId?: string;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);

  function reset() {
    setColumns([]);
    setCsvRows([]);
    setMapping({});
  }

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        if (result.errors.length) {
          toast.error(result.errors[0]?.message || "Could not read CSV");
          return;
        }
        const cols = result.meta.fields?.filter(Boolean) ?? [];
        if (!cols.length) {
          toast.error("CSV has no header row");
          return;
        }
        const nextMapping: Mapping = {};
        for (const col of cols) {
          nextMapping[col] = suggestLeadField(col);
        }
        setColumns(cols);
        setCsvRows(result.data);
        setMapping(nextMapping);
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {campaignId ? "Import leads into this campaign" : "Import leads"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Email is unique. The same person is stored once and linked to campaigns
          by reference. Re-importing will not create a duplicate.
        </p>
        <input
          className="block text-sm"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFile(file);
            }
          }}
        />
        {columns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4">CSV column</th>
                  <th className="py-2 pr-4">Sample</th>
                  <th className="py-2">Maps to</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col} className="border-b border-border">
                    <td className="py-2 pr-4 font-medium">{col}</td>
                    <td className="max-w-48 truncate py-2 pr-4 text-muted-foreground">
                      {csvRows[0]?.[col] || "—"}
                    </td>
                    <td className="py-2">
                      <select
                        className="h-8 rounded-lg border border-input bg-background px-2"
                        value={mapping[col] || "skip"}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [col]: event.target.value as LeadFieldKey | "skip",
                          }))
                        }
                      >
                        <option value="skip">Don&apos;t import</option>
                        {LEAD_FIELDS.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Email is required. Other columns can become variables in your emails.
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={!csvRows.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result: ImportResult = campaignId
                  ? await importCampaignLeads(campaignId, mapping, csvRows)
                  : await importLeads(mapping, csvRows);
                const skipped = result.skippedNoEmail + result.skippedInvalid;
                const enrolled = result.enrolled ?? 0;
                const already = result.alreadyEnrolled ?? 0;
                toast.success(
                  campaignId
                    ? `Saved ${result.imported} new, reused ${result.updated}, enrolled ${enrolled}, already in campaign ${already}, skipped ${skipped}`
                    : `Saved ${result.imported} new, already had ${result.updated}, skipped ${skipped}`,
                );
                reset();
                onOpenChange(false);
                onImported();
              } catch {
                // interceptor
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : `Import ${csvRows.length || ""} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
