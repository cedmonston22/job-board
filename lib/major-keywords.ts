// Phase 3 — major → keyword lookup for the scraper title filter.
//
// When ScrapeFilter.roles is empty but ScrapeFilter.major is set, the scraper
// filter pipeline (lib/scrapers/filter.ts) substring-matches each job title
// (case-insensitive) against this list. A hit on ANY keyword keeps the job.
//
// The shape — keys = display names, values = lowercase keyword arrays — is
// what drives the major dropdown in the filter-config UI (Object.keys is the
// option list). If you add a new major, also add it here.

export const MAJOR_KEYWORDS = {
  "Computer Science": [
    "software",
    "engineer",
    "developer",
    "swe",
    "programmer",
    "backend",
    "frontend",
    "full stack",
    "fullstack",
    "full-stack",
    "web",
    "mobile",
    "ios",
    "android",
    "devops",
    "site reliability",
    "sre",
    "platform",
    "infrastructure",
  ],
  "Data Science": [
    "data scientist",
    "data engineer",
    "data analyst",
    "analytics",
    "machine learning",
    "ml engineer",
    "ai engineer",
    "research scientist",
    "applied scientist",
  ],
  "Electrical Engineering": [
    "electrical",
    "hardware",
    "firmware",
    "embedded",
    "fpga",
    "asic",
    "rf",
    "circuit",
    "signal",
  ],
  "Mechanical Engineering": [
    "mechanical",
    "manufacturing",
    "robotics",
    "cad",
    "mechatronics",
    "controls",
    "thermal",
  ],
  "Business": [
    "business analyst",
    "operations",
    "product manager",
    "strategy",
    "consultant",
    "finance",
    "marketing",
    "sales",
  ],
  "Design": [
    "designer",
    "ux",
    "ui",
    "product designer",
    "graphic",
    "visual",
    "brand",
    "motion",
  ],
} as const;

// String-literal union of the dropdown options. Used by the Zod schema and
// the filter UI so adding a new major above flows through to types
// automatically.
export type Major = keyof typeof MAJOR_KEYWORDS;

export const MAJOR_OPTIONS = Object.keys(MAJOR_KEYWORDS) as Major[];
