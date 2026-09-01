import { axiosInstance } from "../services/AxiosHandler";
import { ENDPOINTS } from "../services/Endpoints";
import type { Mailbox } from "../types/mailbox";

export async function listMailboxes() {
  const { data } = await axiosInstance.get<{ mailboxes: Mailbox[] }>(
    ENDPOINTS.MAILBOXES.LIST,
  );
  return data.mailboxes;
}

export async function startGmailConnect() {
  const { data } = await axiosInstance.get<{ url: string }>(
    ENDPOINTS.MAILBOXES.GMAIL_CONNECT,
  );
  if (!data.url) {
    throw new Error("No Google connect URL returned");
  }
  window.location.href = data.url;
}

export async function removeMailbox(id: string) {
  await axiosInstance.delete(ENDPOINTS.MAILBOXES.REMOVE(id));
}
