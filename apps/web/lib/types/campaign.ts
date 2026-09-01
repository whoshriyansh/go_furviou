export type DelayUnit = "minutes" | "hours" | "days";

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type CampaignStep = {
  _id?: string;
  key?: string;
  order: number;
  delayValue: number;
  delayUnit: DelayUnit;
  subject: string;
  body: string;
  sendAsReply: boolean;
};

export type CampaignSender = {
  _id: string;
  email: string;
  provider: string;
  status: string;
  fromName?: string;
};

export type CampaignStats = {
  total: number;
  queued: number;
  active: number;
  paused: number;
  completed: number;
  replied: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
  sent: number;
};

export type RecentSend = {
  _id: string;
  subject: string;
  status: string;
  stepOrder: number;
  sentAt?: string;
  error?: string;
  createdAt: string;
  leadId?: {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
};

export type Campaign = {
  _id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  steps: CampaignStep[];
  sendingAccountIds: Array<CampaignSender | string>;
  dailySendingLimit: number;
  delayBetweenLeadsSeconds: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendDays: string[];
  timezone: string;
  stopOnReply: boolean;
  autoEnrollNewLeads: boolean;
  sequenceComplete: boolean;
  createdAt: string;
  updatedAt?: string;
  stats?: CampaignStats;
  recentSends?: RecentSend[];
  sending?: CampaignSending;
};

export type CampaignSending = {
  inWindow: boolean;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  nextSlot: string;
  nextLeadAt: string | null;
  nextLeadLabel: string | null;
  dueCount: number;
  lastError: string | null;
  reason: string;
  worker: {
    lastTickAt: string | null;
    lastTickDue: number;
    lastTickSent: number;
    lastTickHeld: number;
    lastTickError: string | null;
    intervalMs: number;
  };
};

export type CampaignUpdate = {
  name?: string;
  description?: string;
  steps?: CampaignStep[];
  sendingAccountIds?: string[];
  dailySendingLimit?: number;
  delayBetweenLeadsSeconds?: number;
  sendWindowStart?: string;
  sendWindowEnd?: string;
  sendDays?: string[];
  timezone?: string;
  stopOnReply?: boolean;
  autoEnrollNewLeads?: boolean;
};

export type CampaignTab = "sequence" | "leads" | "launch" | "performance";
