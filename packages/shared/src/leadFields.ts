export type LeadFieldKey =
  | "email"
  | "firstName"
  | "lastName"
  | "fullName"
  | "mobile"
  | "website"
  | "instagram"
  | "linkedin"
  | "company"
  | "jobTitle"
  | "subjectLine"
  | "iceBreaker"
  | "followUp1"
  | "followUp2"
  | "followUp3"
  | "demoProject"
  | "googleReviewCount"
  | "averageRating"
  | "city"
  | "country"
  | "notes";

export const FOLLOW_UP_FIELDS: LeadFieldKey[] = [
  "followUp1",
  "followUp2",
  "followUp3",
];

export const LEAD_FIELDS: { key: LeadFieldKey; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "mobile", label: "Mobile" },
  { key: "company", label: "Company" },
  { key: "jobTitle", label: "Job title" },
  { key: "website", label: "Website" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "subjectLine", label: "Subject line" },
  { key: "iceBreaker", label: "Icebreaker" },
  { key: "followUp1", label: "Follow-up 1" },
  { key: "followUp2", label: "Follow-up 2" },
  { key: "followUp3", label: "Follow-up 3" },
  { key: "demoProject", label: "Demo project" },
  { key: "googleReviewCount", label: "Google review count" },
  { key: "averageRating", label: "Average rating" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "notes", label: "Notes" },
];

const ALIASES: Record<string, LeadFieldKey> = {
  email: "email",
  emai: "email",
  mail: "email",
  emailaddress: "email",
  firstname: "firstName",
  first: "firstName",
  fname: "firstName",
  lastname: "lastName",
  last: "lastName",
  lname: "lastName",
  fullname: "fullName",
  name: "fullName",
  contactname: "fullName",
  mobile: "mobile",
  phone: "mobile",
  phonenumber: "mobile",
  cellphone: "mobile",
  website: "website",
  url: "website",
  domain: "website",
  currentdomain: "website",
  instagram: "instagram",
  insta: "instagram",
  ig: "instagram",
  linkedin: "linkedin",
  linkedinurl: "linkedin",
  company: "company",
  companyname: "company",
  businessname: "company",
  jobtitle: "jobTitle",
  title: "jobTitle",
  contacttitle: "jobTitle",
  subjectline: "subjectLine",
  subject: "subjectLine",
  icebreaker: "iceBreaker",
  ice: "iceBreaker",
  email1: "iceBreaker",
  email1icebreaker: "iceBreaker",
  followup1: "followUp1",
  followup2: "followUp2",
  followup3: "followUp3",
  fu1: "followUp1",
  fu2: "followUp2",
  fu3: "followUp3",
  demoproject: "demoProject",
  demo: "demoProject",
  googlereviewcount: "googleReviewCount",
  reviewcount: "googleReviewCount",
  reviews: "googleReviewCount",
  averagerating: "averageRating",
  averagingreviewcount: "averageRating",
  avgrating: "averageRating",
  rating: "averageRating",
  city: "city",
  citystate: "city",
  country: "country",
  notes: "notes",
  note: "notes",
};

export function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function stripLeadingSubjectLine(text: string) {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!lines.length || !/^\s*Subject:/i.test(lines[0] || "")) {
    return raw.trim();
  }
  let index = 1;
  while (index < lines.length && !lines[index]?.trim()) {
    index += 1;
  }
  return lines.slice(index).join("\n").trim();
}

export function suggestLeadField(header: string): LeadFieldKey | "skip" {
  const key = normalizeHeader(header);
  if (ALIASES[key]) {
    return ALIASES[key];
  }
  if (/followup1|fu1/.test(key)) {
    return "followUp1";
  }
  if (/followup2|fu2/.test(key)) {
    return "followUp2";
  }
  if (/followup3|fu3/.test(key)) {
    return "followUp3";
  }
  if (key.includes("icebreaker")) {
    return "iceBreaker";
  }
  if (key.includes("subjectline") || key === "subject") {
    return "subjectLine";
  }
  return "skip";
}
