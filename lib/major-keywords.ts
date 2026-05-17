// Phase 3 — major → keyword lookup for the scraper title filter.
//
// When ScrapeFilter.roles is empty but ScrapeFilter.major is set, the
// scraper filter pipeline (lib/scrapers/filter.ts) substring-matches each
// job title (case-insensitive) against the major's keyword array. A hit on
// ANY keyword keeps the job.
//
// Shape: keys = display names (used directly in the dropdown), values =
// lowercase keyword arrays. Object.keys produces MAJOR_OPTIONS, used by the
// combobox to list options and by the Zod schema to validate the selection.
//
// Curated to the ~50 most common US college majors. Add new entries as
// needed — both the dropdown and the type literal pick them up via
// `keyof typeof MAJOR_KEYWORDS`.

export const MAJOR_KEYWORDS = {
  // ----- Engineering & Computer Science -----
  "Computer Science": [
    "software", "engineer", "developer", "swe", "programmer",
    "backend", "frontend", "fullstack", "full-stack", "full stack",
    "web", "mobile", "ios", "android", "devops", "sre",
    "site reliability", "platform", "infrastructure",
  ],
  "Computer Engineering": [
    "computer engineer", "embedded", "firmware", "hardware engineer",
    "system engineer", "fpga",
  ],
  "Software Engineering": [
    "software engineer", "software developer", "swe", "developer",
    "engineer", "programmer", "backend", "frontend",
  ],
  "Data Science": [
    "data scientist", "data engineer", "data analyst", "analytics",
    "machine learning", "ml engineer", "ai engineer",
    "research scientist", "applied scientist",
  ],
  "Information Technology": [
    "it support", "system administrator", "sysadmin", "network",
    "help desk", "it analyst", "it engineer", "infrastructure",
  ],
  "Information Systems": [
    "business analyst", "systems analyst", "it analyst", "consultant",
    "implementation", "erp", "salesforce",
  ],
  "Cybersecurity": [
    "security", "cyber", "penetration", "pentest", "infosec",
    "soc analyst", "compliance", "incident response", "appsec",
  ],
  "Electrical Engineering": [
    "electrical", "hardware", "firmware", "embedded", "fpga",
    "asic", "rf", "circuit", "signal", "power",
  ],
  "Mechanical Engineering": [
    "mechanical", "manufacturing", "robotics", "cad", "mechatronics",
    "controls", "thermal",
  ],
  "Civil Engineering": [
    "civil", "structural", "transportation", "geotechnical",
    "construction engineer", "infrastructure",
  ],
  "Chemical Engineering": [
    "chemical engineer", "process engineer", "refinery",
    "pharmaceutical", "polymer",
  ],
  "Biomedical Engineering": [
    "biomedical", "medical device", "bioengineer", "tissue", "imaging",
  ],
  "Aerospace Engineering": [
    "aerospace", "aeronautical", "astronautical", "flight",
    "propulsion", "spacecraft",
  ],
  "Industrial Engineering": [
    "industrial engineer", "operations", "process engineer",
    "supply chain", "logistics", "optimization",
  ],
  "Environmental Engineering": [
    "environmental", "sustainability", "water", "waste", "energy",
  ],
  "Materials Science": [
    "materials", "metallurgy", "ceramic", "polymer", "nanomaterials",
  ],

  // ----- Math & Sciences -----
  "Mathematics": [
    "mathematician", "quantitative", "quant", "actuary",
    "statistician", "research scientist", "modeler",
  ],
  "Statistics": [
    "statistician", "biostatistician", "data analyst", "analyst",
    "quantitative", "research",
  ],
  "Physics": [
    "physicist", "research", "scientist", "optical", "quantum",
    "instrumentation",
  ],
  "Chemistry": [
    "chemist", "research scientist", "analytical chemist",
    "lab", "synthesis",
  ],
  "Biology": [
    "biologist", "research scientist", "lab", "scientist",
    "molecular", "genomics",
  ],
  "Biochemistry": [
    "biochemist", "research scientist", "lab", "molecular",
    "protein", "enzyme",
  ],
  "Neuroscience": [
    "neuroscientist", "research scientist", "lab", "neural",
    "cognitive",
  ],

  // ----- Business -----
  "Business Administration": [
    "business analyst", "operations", "associate", "consultant",
    "coordinator", "manager", "specialist", "general management",
  ],
  "Finance": [
    "finance", "financial analyst", "investment", "banking",
    "trading", "portfolio", "treasury", "audit", "actuary",
  ],
  "Accounting": [
    "accountant", "audit", "auditor", "tax", "controller",
    "bookkeeper", "cpa",
  ],
  "Marketing": [
    "marketing", "brand", "growth", "seo", "sem", "advertising",
    "content", "social media", "communications",
  ],
  "Management": [
    "manager", "associate", "coordinator", "consultant", "operations",
  ],
  "Economics": [
    "economist", "research analyst", "policy analyst", "data analyst",
    "consulting", "research",
  ],
  "Supply Chain Management": [
    "supply chain", "logistics", "procurement", "operations",
    "warehouse", "fulfillment",
  ],
  "International Business": [
    "international", "global", "trade", "consultant", "associate",
    "analyst",
  ],
  "Entrepreneurship": [
    "founder", "co-founder", "venture", "startup", "associate",
    "business development",
  ],
  "Human Resources": [
    "human resources", "hr", "people", "talent", "recruiter",
    "people operations",
  ],

  // ----- Social Sciences & Humanities -----
  "Psychology": [
    "psychologist", "research assistant", "counselor", "therapist",
    "behavioral", "user research", "ux research",
  ],
  "Sociology": [
    "research", "analyst", "policy", "social", "community",
    "advocacy",
  ],
  "Political Science": [
    "policy", "political", "government", "legislative", "advocacy",
    "consultant", "analyst",
  ],
  "International Relations": [
    "international", "policy", "foreign", "diplomatic", "consultant",
    "analyst", "advisor",
  ],
  "Public Policy": [
    "policy", "public", "government", "legislative", "advocacy",
    "analyst",
  ],
  "History": [
    "historian", "researcher", "archivist", "curator", "analyst",
  ],
  "Philosophy": [
    "researcher", "analyst", "associate", "consultant", "writer",
  ],
  "English": [
    "writer", "editor", "content", "copywriter", "journalist",
    "communications",
  ],
  "Communications": [
    "communications", "public relations", "pr", "writer", "content",
    "media", "marketing",
  ],
  "Journalism": [
    "journalist", "reporter", "writer", "editor", "content",
    "media", "communications",
  ],

  // ----- Arts & Design -----
  "Design": [
    "designer", "ux", "ui", "product designer", "graphic",
    "visual", "brand", "motion",
  ],
  "Graphic Design": [
    "graphic designer", "visual designer", "designer", "brand",
    "creative", "illustration",
  ],
  "Architecture": [
    "architect", "architectural", "designer", "draftsperson",
    "urban planner", "interior",
  ],
  "Film & Media": [
    "filmmaker", "producer", "director", "editor", "videographer",
    "cinematographer", "media", "content",
  ],
  "Music": [
    "musician", "composer", "audio", "sound", "music",
    "production",
  ],

  // ----- Health -----
  "Nursing": [
    "nurse", "rn", "lpn", "nursing", "clinical",
  ],
  "Public Health": [
    "public health", "epidemiologist", "health analyst",
    "community health", "research", "policy",
  ],
  "Health Sciences": [
    "clinical", "research", "health", "medical", "patient",
    "analyst",
  ],

  // ----- Education -----
  "Education": [
    "teacher", "educator", "instructional designer", "curriculum",
    "tutor", "trainer", "learning",
  ],
} as const;

// String-literal union of the dropdown options. Used by the Zod schema and
// the combobox UI so adding a new major above flows through to types
// automatically.
export type Major = keyof typeof MAJOR_KEYWORDS;

export const MAJOR_OPTIONS = Object.keys(MAJOR_KEYWORDS) as Major[];
