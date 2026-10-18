// Pipeline for demo requests ("queries") coming from the website form.
export const STATUSES = [
  { key: "new", label: "New", hint: "Waiting for first reply", tone: "info" },
  { key: "contacted", label: "Contacted", hint: "First reply sent", tone: "progress" },
  { key: "demo_scheduled", label: "Demo scheduled", hint: "Live demo booked", tone: "progress" },
  { key: "proposal", label: "Proposal sent", hint: "Quote shared", tone: "progress" },
  { key: "won", label: "Won", hint: "Customer", tone: "good" },
  { key: "lost", label: "Lost", hint: "Closed, not won", tone: "bad" },
  { key: "spam", label: "Spam", hint: "Not a real enquiry", tone: "muted" },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
export const OPEN_STATUSES = ["new", "contacted", "demo_scheduled", "proposal"];
export const PIPELINE = ["new", "contacted", "demo_scheduled", "proposal", "won"];

export const PRIORITIES = [
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" },
];

// Mirrors INDUSTRY_OPTIONS / CAMERA_OPTIONS in the website (src/data/site.js).
export const INDUSTRY_OPTIONS = [
  "Schools & Campuses", "Pharma", "Construction", "Manufacturing",
  "Hospitality", "Food & Beverage", "Logistics", "Other",
];
export const CAMERA_OPTIONS = ["1–10", "11–50", "51–200", "200+"];

// The website promises "We reply within 24 hours".
export const SLA_HOURS = 24;

export const PAGE_TITLES = {
  "/": "Home",
  "/solutions": "Solutions",
  "/industries": "Industries",
  "/about": "About",
  "/contact": "Contact",
  "/privacy": "Privacy",
};

export const COUNTRY_NAMES = {
  IN: "India", US: "United States", AE: "UAE", GB: "United Kingdom", SG: "Singapore",
  SA: "Saudi Arabia", AU: "Australia", CA: "Canada", DE: "Germany", NP: "Nepal", BD: "Bangladesh",
};
