import { axiosInstance } from "../services/AxiosHandler";
import { ENDPOINTS } from "../services/Endpoints";
import type { LeadListResponse } from "../types/lead";
import type { LeadFieldKey } from "@furviou/shared";

export async function listLeads(params?: {
  page?: number;
  limit?: number;
  q?: string;
}) {
  const { data } = await axiosInstance.get<LeadListResponse>(
    ENDPOINTS.LEADS.LIST,
    { params },
  );
  return data;
}

export async function importLeads(
  mapping: Record<string, LeadFieldKey | "skip">,
  rows: Record<string, string>[],
) {
  const { data } = await axiosInstance.post<{
    imported: number;
    updated: number;
    enrolled: number;
    alreadyEnrolled: number;
    skippedNoEmail: number;
    skippedInvalid: number;
  }>(
    ENDPOINTS.LEADS.IMPORT,
    { mapping, rows },
    { timeout: 120000 },
  );
  return data;
}
