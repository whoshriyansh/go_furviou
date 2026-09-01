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
  | "iceBreaker"
  | "demoProject"
  | "googleReviewCount"
  | "averageRating"
  | "city"
  | "country"
  | "notes";

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
  { key: "iceBreaker", label: "Icebreaker" },
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
  mobile: "mobile",
  phone: "mobile",
  phonenumber: "mobile",
  cellphone: "mobile",
  website: "website",
  url: "website",
  domain: "website",
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
  icebreaker: "iceBreaker",
  ice: "iceBreaker",
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
  country: "country",
  notes: "notes",
  note: "notes",
};

export function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function suggestLeadField(header: string): LeadFieldKey | "skip" {
  return ALIASES[normalizeHeader(header)] || "skip";
}
