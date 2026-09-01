import { axiosInstance } from "../services/AxiosHandler";
import { ENDPOINTS } from "../services/Endpoints";
import type { LeadListResponse } from "../types/lead";

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
