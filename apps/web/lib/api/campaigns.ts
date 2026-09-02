import { axiosInstance } from "../services/AxiosHandler";
import { ENDPOINTS } from "../services/Endpoints";
import type { Campaign, CampaignUpdate } from "../types/campaign";
import type { Lead, LeadListResponse } from "../types/lead";
import type { LeadFieldKey } from "@furviou/shared";

export async function listCampaigns() {
  const { data } = await axiosInstance.get<{ campaigns: Campaign[] }>(
    ENDPOINTS.CAMPAIGNS.LIST,
  );
  return data.campaigns;
}

export async function createCampaign(input: {
  name: string;
  description?: string;
  timezone?: string;
}) {
  const { data } = await axiosInstance.post<{ campaign: Campaign }>(
    ENDPOINTS.CAMPAIGNS.LIST,
    input,
  );
  return data.campaign;
}

export async function getCampaign(id: string) {
  const { data } = await axiosInstance.get<{ campaign: Campaign }>(
    ENDPOINTS.CAMPAIGNS.ONE(id),
  );
  return data.campaign;
}

export async function updateCampaign(id: string, input: CampaignUpdate) {
  const { data } = await axiosInstance.patch<{ campaign: Campaign }>(
    ENDPOINTS.CAMPAIGNS.ONE(id),
    input,
  );
  return data.campaign;
}

export async function launchCampaign(id: string) {
  const { data } = await axiosInstance.post<{ campaign: Campaign }>(
    ENDPOINTS.CAMPAIGNS.LAUNCH(id),
  );
  return data.campaign;
}

export async function pauseCampaign(id: string) {
  const { data } = await axiosInstance.post<{ campaign: Campaign }>(
    ENDPOINTS.CAMPAIGNS.PAUSE(id),
  );
  return data.campaign;
}

export async function resumeCampaign(id: string) {
  const { data } = await axiosInstance.post<{ campaign: Campaign }>(
    ENDPOINTS.CAMPAIGNS.RESUME(id),
  );
  return data.campaign;
}

export async function sendNowCampaign(id: string, limit = 1) {
  const { data } = await axiosInstance.post<{
    sent: number;
    failed: number;
    held: number;
    skipped: number;
    results: Array<{ status: string; message?: string }>;
    campaign: Campaign;
  }>(
    ENDPOINTS.CAMPAIGNS.SEND_NOW(id),
    { limit },
    { timeout: 60000 },
  );
  return data;
}

export async function listCampaignLeads(
  campaignId: string,
  params?: { page?: number; limit?: number; q?: string },
) {
  const { data } = await axiosInstance.get<LeadListResponse>(
    ENDPOINTS.CAMPAIGNS.LEADS(campaignId),
    { params },
  );
  return data;
}

export async function importCampaignLeads(
  campaignId: string,
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
    ENDPOINTS.CAMPAIGNS.IMPORT(campaignId),
    { mapping, rows },
    { timeout: 120000 },
  );
  return data;
}

export type { Campaign, Lead };
