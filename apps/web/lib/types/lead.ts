export type LeadCampaignRef = {
  id: string;
  name: string;
};

export type Lead = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  mobile?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  company?: string;
  jobTitle?: string;
  iceBreaker?: string;
  city?: string;
  country?: string;
  notes?: string;
  campaignIds?: string[];
  campaigns?: LeadCampaignRef[];
  enrollmentId?: string;
  enrollmentStatus?: string;
  currentStep?: number;
  nextSendAt?: string;
  lastSentAt?: string;
  lastError?: string;
};

export type LeadListResponse = {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
};
