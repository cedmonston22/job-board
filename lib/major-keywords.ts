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
// Curated to ~200 of the most common US undergraduate majors (currently 207),
// sourced from the US DoEd CIP taxonomy and the most-conferred bachelor's
// distributions. Add new entries as needed — both the dropdown and the type
// literal pick them up via `keyof typeof MAJOR_KEYWORDS`.

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
  "Artificial Intelligence": [
    "ai engineer", "machine learning", "ml engineer", "mlops",
    "applied scientist", "research scientist", "nlp", "computer vision",
    "deep learning",
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
    "environmental engineer", "sustainability", "water resources",
    "waste", "remediation",
  ],
  "Materials Science": [
    "materials", "metallurgy", "ceramic", "polymer", "nanomaterials",
  ],
  "Nuclear Engineering": [
    "nuclear", "reactor", "radiation", "health physics", "plasma",
  ],
  "Petroleum Engineering": [
    "petroleum", "reservoir", "drilling", "production engineer",
    "completions",
  ],
  "Agricultural Engineering": [
    "agricultural engineer", "biosystems", "irrigation", "food engineer",
  ],
  "Systems Engineering": [
    "systems engineer", "integration", "requirements", "test engineer",
    "platform engineer",
  ],
  "Engineering Management": [
    "engineering manager", "program manager", "project engineer",
    "operations manager", "technical lead",
  ],
  "Robotics": [
    "robotics", "controls", "perception", "slam", "automation",
    "mechatronics",
  ],
  "Game Design": [
    "game", "gameplay", "level designer", "unity", "unreal",
    "engine programmer",
  ],

  // ----- Physical Sciences -----
  "Physics": [
    "physicist", "research scientist", "optical", "quantum",
    "instrumentation",
  ],
  "Astronomy": [
    "astronomer", "astrophysicist", "research scientist", "observational",
    "telescope",
  ],
  "Chemistry": [
    "chemist", "research scientist", "analytical chemist",
    "lab", "synthesis",
  ],
  "Geology": [
    "geologist", "geoscientist", "field geologist", "hydrogeologist",
    "mining engineer", "exploration",
  ],
  "Earth Science": [
    "geoscientist", "earth scientist", "field scientist",
    "environmental scientist",
  ],
  "Meteorology": [
    "meteorologist", "weather forecaster", "atmospheric scientist",
    "climate",
  ],
  "Oceanography": [
    "oceanographer", "marine scientist", "research scientist",
    "hydrographer",
  ],
  "Geophysics": [
    "geophysicist", "seismologist", "exploration geophysicist",
    "research scientist",
  ],

  // ----- Life Sciences / Biology -----
  "Biology": [
    "biologist", "research scientist", "lab", "scientist",
    "molecular", "genomics",
  ],
  "Biochemistry": [
    "biochemist", "research scientist", "lab", "molecular",
    "protein", "enzyme",
  ],
  "Microbiology": [
    "microbiologist", "lab", "research scientist", "qc microbiologist",
    "fermentation",
  ],
  "Molecular Biology": [
    "molecular biologist", "research scientist", "lab", "genomics",
    "cell biologist",
  ],
  "Genetics": [
    "geneticist", "genetic counselor", "research scientist", "genomics",
    "bioinformatics",
  ],
  "Neuroscience": [
    "neuroscientist", "research scientist", "lab", "neural",
    "cognitive",
  ],
  "Marine Biology": [
    "marine biologist", "research scientist", "field biologist",
    "aquatic",
  ],
  "Ecology": [
    "ecologist", "field biologist", "conservation", "environmental scientist",
    "research scientist",
  ],
  "Zoology": [
    "zoologist", "wildlife biologist", "field biologist", "curator",
  ],
  "Botany": [
    "botanist", "plant scientist", "horticulturist", "research scientist",
  ],
  "Bioinformatics": [
    "bioinformatics", "computational biologist", "data scientist",
    "research scientist", "genomics",
  ],
  "Biotechnology": [
    "biotech", "research associate", "scientist", "lab",
    "bioprocess",
  ],

  // ----- Math / Statistics / Quantitative -----
  "Mathematics": [
    "mathematician", "quantitative", "quant", "actuary",
    "statistician", "research scientist", "modeler",
  ],
  "Applied Mathematics": [
    "quantitative", "quant", "modeler", "research scientist",
    "operations research",
  ],
  "Statistics": [
    "statistician", "biostatistician", "data analyst", "analyst",
    "quantitative", "research",
  ],
  "Actuarial Science": [
    "actuary", "actuarial", "risk analyst", "pricing analyst",
  ],
  "Data Analytics": [
    "data analyst", "analytics", "bi analyst", "business intelligence",
    "reporting analyst",
  ],
  "Business Analytics": [
    "business analyst", "data analyst", "analytics",
    "business intelligence", "bi analyst",
  ],
  "Operations Research": [
    "operations research", "optimization", "supply chain analyst",
    "quantitative analyst",
  ],
  "Quantitative Finance": [
    "quant", "quantitative analyst", "quantitative researcher",
    "trading", "risk analyst",
  ],

  // ----- Business / Finance / Accounting -----
  "Business Administration": [
    "business analyst", "business operations", "chief of staff",
    "strategy", "general manager", "consultant",
  ],
  "Finance": [
    "finance", "financial analyst", "investment", "banking",
    "trading", "portfolio", "treasury", "audit", "actuary",
  ],
  "Accounting": [
    "accountant", "audit", "auditor", "tax", "controller",
    "bookkeeper", "cpa",
  ],
  "Management": [
    "general manager", "operations manager", "business manager",
    "program manager", "project manager", "management consultant",
    "chief of staff",
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
  "Real Estate": [
    "real estate", "broker", "property manager", "leasing",
    "appraiser", "asset manager",
  ],
  "Hospitality Management": [
    "hospitality", "hotel manager", "restaurant manager", "event manager",
    "food and beverage",
  ],
  "Sports Management": [
    "sports", "athletic", "event coordinator", "operations",
    "sponsorship",
  ],
  "Investment Management": [
    "investment", "portfolio manager", "asset manager",
    "wealth manager", "research analyst",
  ],
  "Risk Management": [
    "risk analyst", "risk manager", "compliance", "underwriter",
    "credit analyst",
  ],
  "Insurance": [
    "underwriter", "claims adjuster", "insurance", "actuary",
    "risk analyst",
  ],
  "Banking": [
    "banking", "credit analyst", "loan officer", "branch manager",
    "investment banking", "commercial banking",
  ],
  "Operations Management": [
    "operations manager", "operations analyst", "process improvement",
    "supply chain", "logistics",
  ],
  "Project Management": [
    "project manager", "program manager", "scrum master",
    "project coordinator", "pmp",
  ],
  "Logistics": [
    "logistics", "supply chain", "warehouse", "distribution",
    "fulfillment",
  ],
  "Organizational Behavior": [
    "organizational development", "hr", "talent", "people operations",
    "consultant",
  ],
  "Taxation": [
    "tax", "tax analyst", "tax accountant", "cpa", "tax consultant",
  ],

  // ----- Marketing / Advertising / Communications -----
  "Marketing": [
    "marketing", "brand", "growth", "seo", "sem", "advertising",
    "content", "social media", "communications",
  ],
  "Advertising": [
    "advertising", "account executive", "media planner", "copywriter",
    "creative", "brand",
  ],
  "Public Relations": [
    "public relations", "pr", "communications", "media relations",
    "publicist",
  ],
  "Communications": [
    "communications", "public relations", "pr", "writer", "content",
    "media", "marketing",
  ],
  "Digital Marketing": [
    "digital marketing", "seo", "sem", "growth", "performance marketing",
    "social media", "marketing analyst",
  ],
  "Journalism": [
    "journalist", "reporter", "writer", "editor", "content",
    "media", "communications",
  ],
  "Media Studies": [
    "media", "content", "producer", "communications", "social media",
  ],
  "Broadcasting": [
    "broadcast", "producer", "anchor", "reporter", "media",
    "videographer",
  ],
  "Strategic Communication": [
    "communications", "public relations", "brand", "content strategist",
    "marketing",
  ],
  // ----- Economics / Public Policy -----
  "Economics": [
    "economist", "research analyst", "policy analyst", "data analyst",
    "consulting", "research",
  ],
  "International Relations": [
    "international", "policy", "foreign", "diplomatic", "consultant",
    "analyst", "advisor",
  ],
  "Public Policy": [
    "policy", "public", "government", "legislative", "advocacy",
    "analyst",
  ],
  "Public Administration": [
    "public administration", "government", "city manager", "policy",
    "program manager", "nonprofit",
  ],
  "Political Science": [
    "policy", "political", "government", "legislative", "advocacy",
    "consultant", "analyst",
  ],
  "Government": [
    "government", "policy", "legislative", "public affairs",
    "civil servant",
  ],
  "Urban Studies": [
    "urban planner", "city planner", "policy analyst", "community development",
    "transportation planner",
  ],
  "Development Studies": [
    "international development", "policy analyst", "program manager",
    "nonprofit", "research analyst",
  ],

  // ----- Pre-Med / Health Sciences / Nursing -----
  "Pre-Medicine": [
    "medical scribe", "clinical research", "research assistant",
    "lab technician", "ema", "emt",
  ],
  "Nursing": [
    "nurse", "rn", "lpn", "nursing", "clinical",
  ],
  "Public Health": [
    "public health", "epidemiologist", "health analyst",
    "community health", "research", "policy",
  ],
  "Health Sciences": [
    "clinical research", "clinical coordinator", "health educator",
    "patient navigator", "medical assistant", "healthcare analyst",
  ],
  "Health Administration": [
    "healthcare administrator", "practice manager", "health policy",
    "hospital administrator", "operations",
  ],
  "Pharmacy": [
    "pharmacist", "pharmacy technician", "clinical pharmacist",
    "pharmaceutical",
  ],
  "Pharmaceutical Sciences": [
    "pharmaceutical", "pharmacology", "research scientist",
    "drug development", "formulation",
  ],
  "Dental Hygiene": [
    "dental hygienist", "dental assistant", "dental",
  ],
  "Physical Therapy": [
    "physical therapist", "pt", "rehabilitation", "athletic trainer",
  ],
  "Occupational Therapy": [
    "occupational therapist", "ot", "rehabilitation",
  ],
  "Speech Pathology": [
    "speech pathologist", "speech therapist", "slp",
    "communication disorders",
  ],
  "Radiologic Technology": [
    "radiologic technologist", "rad tech", "mri technologist",
    "ct technologist", "x-ray",
  ],
  "Respiratory Therapy": [
    "respiratory therapist", "rt", "pulmonary",
  ],
  "Medical Laboratory Science": [
    "medical laboratory", "lab technician", "medical technologist",
    "clinical lab",
  ],
  "Nutrition": [
    "nutritionist", "dietitian", "rd", "food scientist",
    "health coach",
  ],
  "Dietetics": [
    "dietitian", "rd", "nutritionist", "clinical dietitian",
  ],
  "Athletic Training": [
    "athletic trainer", "rehabilitation", "strength and conditioning",
    "sports medicine",
  ],
  "Epidemiology": [
    "epidemiologist", "public health", "biostatistician",
    "research scientist", "disease investigator",
  ],
  "Health Informatics": [
    "health informatics", "clinical informatics", "ehr", "epic analyst",
    "healthcare data analyst",
  ],

  // ----- Education -----
  "Education": [
    "teacher", "educator", "instructional designer", "curriculum",
    "tutor", "trainer", "learning",
  ],
  "Elementary Education": [
    "elementary teacher", "teacher", "educator", "curriculum",
    "instructional",
  ],
  "Secondary Education": [
    "high school teacher", "teacher", "educator", "curriculum",
    "instructional",
  ],
  "Special Education": [
    "special education", "sped teacher", "behavior specialist",
    "teacher", "paraprofessional",
  ],
  "Early Childhood Education": [
    "early childhood", "preschool teacher", "daycare", "teacher",
    "child development",
  ],
  "Curriculum and Instruction": [
    "curriculum", "instructional designer", "instructional coach",
    "education specialist",
  ],
  "Educational Leadership": [
    "principal", "assistant principal", "school administrator",
    "instructional coach", "dean",
  ],
  "Educational Technology": [
    "instructional designer", "edtech", "learning experience",
    "lms administrator", "training",
  ],
  "Counselor Education": [
    "school counselor", "guidance counselor", "academic advisor",
    "counselor",
  ],
  "Library Science": [
    "librarian", "library", "archivist", "information specialist",
  ],

  // ----- Psychology / Social Work -----
  "Psychology": [
    "psychologist", "research assistant", "counselor", "therapist",
    "behavioral", "user research", "ux research",
  ],
  "Clinical Psychology": [
    "clinical psychologist", "therapist", "counselor",
    "mental health", "behavioral",
  ],
  "Cognitive Science": [
    "cognitive scientist", "ux researcher", "user research",
    "research scientist", "data scientist",
  ],
  "Behavioral Science": [
    "behavioral scientist", "user research", "research analyst",
    "behavior analyst",
  ],
  "Counseling": [
    "counselor", "therapist", "mental health", "case manager",
    "behavioral health",
  ],
  "Social Work": [
    "social worker", "case manager", "msw", "lcsw",
    "behavioral health", "community",
  ],
  "Human Services": [
    "case manager", "social worker", "community", "nonprofit",
    "program coordinator",
  ],
  "Child Development": [
    "child development specialist", "early childhood", "preschool",
    "behavioral",
  ],
  "Gerontology": [
    "geriatric", "case manager", "social worker", "activities director",
  ],

  // ----- Sociology / Anthropology / Political Science -----
  "Sociology": [
    "sociologist", "policy analyst", "research analyst", "community",
    "advocacy",
  ],
  "Anthropology": [
    "anthropologist", "ux researcher", "user research",
    "cultural",
  ],
  "Archaeology": [
    "archaeologist", "field technician", "cultural resource",
    "researcher",
  ],
  "Criminology": [
    "criminologist", "research analyst", "policy analyst", "investigator",
    "intelligence analyst",
  ],
  "Demography": [
    "demographer", "research analyst", "data analyst", "policy analyst",
  ],
  "Geography": [
    "geographer", "gis analyst", "cartographer", "urban planner",
    "spatial analyst",
  ],
  "Ethnic Studies": [
    "policy analyst", "community", "advocacy",
    "diversity",
  ],
  "Women's Studies": [
    "advocacy", "policy analyst", "nonprofit",
    "community",
  ],

  // ----- Humanities -----
  "English": [
    "writer", "editor", "content", "copywriter", "journalist",
    "communications",
  ],
  "Creative Writing": [
    "writer", "copywriter", "editor", "content", "screenwriter",
  ],
  "Literature": [
    "writer", "editor", "researcher", "content", "publishing",
  ],
  "Comparative Literature": [
    "writer", "editor", "translator",
    // Limited mapping to job titles; broad humanities path.
  ],
  "Linguistics": [
    "linguist", "computational linguist", "nlp", "language specialist",
    "translator",
  ],
  "History": [
    "historian", "archivist", "curator",
  ],
  "Art History": [
    "curator", "gallery", "archivist", "art historian", "researcher",
  ],
  "Philosophy": [
    "associate", "consultant", "writer",
    // Limited direct title mapping; common landing spots in policy/research.
  ],
  "Religious Studies": [
    "chaplain", "minister", "nonprofit", "writer",
    // Limited direct title overlap.
  ],
  "Theology": [
    "chaplain", "minister", "pastor", "nonprofit", "researcher",
  ],
  "Classics": [
    "writer", "editor", "curator", "archivist",
  ],
  "French": [
    "translator", "interpreter", "language specialist", "teacher",
    "international",
  ],
  "Spanish": [
    "translator", "interpreter", "language specialist", "bilingual",
    "teacher",
  ],
  "German": [
    "translator", "interpreter", "language specialist", "teacher",
    "international",
  ],
  "Chinese": [
    "translator", "interpreter", "mandarin", "language specialist",
    "international",
  ],
  "Japanese": [
    "translator", "interpreter", "language specialist", "international",
    "localization",
  ],
  "Arabic": [
    "translator", "interpreter", "language specialist", "intelligence analyst",
    "linguist",
  ],
  "Russian": [
    "translator", "interpreter", "language specialist", "intelligence analyst",
    "linguist",
  ],
  "African American Studies": [
    "policy analyst", "community", "advocacy",
    "diversity",
  ],

  // ----- Arts -----
  "Design": [
    "designer", "ux", "ui", "product designer", "graphic",
    "visual", "brand", "motion",
  ],
  "Graphic Design": [
    "graphic designer", "visual designer", "designer", "brand",
    "creative", "illustration",
  ],
  "Fine Arts": [
    "artist", "illustrator", "designer", "curator", "art director",
  ],
  "Illustration": [
    "illustrator", "concept artist", "designer", "graphic designer",
    "visual designer",
  ],
  "Photography": [
    "photographer", "videographer", "photo editor", "content creator",
    "visual",
  ],
  "Animation": [
    "animator", "motion designer", "3d artist", "rigging artist",
    "vfx",
  ],
  "Film & Media": [
    "filmmaker", "producer", "director", "editor", "videographer",
    "cinematographer", "media", "content",
  ],
  "Theater": [
    "actor", "stage manager", "production assistant", "theater",
    "casting",
  ],
  "Dance": [
    "dancer", "choreographer", "dance instructor", "performer",
  ],
  "Music": [
    "musician", "composer", "audio", "sound", "music",
    "production",
  ],
  "Music Education": [
    "music teacher", "band director", "choir director", "music instructor",
  ],
  "Fashion Design": [
    "fashion designer", "apparel designer", "technical designer",
    "stylist", "buyer",
  ],

  // ----- Architecture / Urban Planning / Design -----
  "Architecture": [
    "architect", "architectural", "designer", "draftsperson",
    "urban planner", "interior",
  ],
  "Landscape Architecture": [
    "landscape architect", "designer", "urban planner",
    "site planner",
  ],
  "Interior Design": [
    "interior designer", "designer", "space planner", "furniture designer",
  ],
  "Urban Planning": [
    "urban planner", "city planner", "transportation planner",
    "community development", "policy analyst",
  ],
  "Construction Management": [
    "construction manager", "project manager", "estimator",
    "superintendent", "project engineer",
  ],
  "Industrial Design": [
    "industrial designer", "product designer", "designer",
    "ux", "design engineer",
  ],
  "Environmental Design": [
    "designer", "urban planner", "landscape architect",
    "sustainability",
  ],

  // ----- Law / Criminal Justice / Public Administration -----
  "Pre-Law": [
    "paralegal", "legal assistant", "law clerk", "compliance analyst",
    "policy analyst",
  ],
  "Paralegal Studies": [
    "paralegal", "legal assistant", "law clerk", "contracts",
  ],
  "Criminal Justice": [
    "police officer", "detective", "probation officer",
    "corrections officer", "investigator", "criminologist",
  ],
  "Forensic Science": [
    "forensic scientist", "crime scene", "forensic analyst",
    "lab technician", "dna analyst",
  ],
  "Homeland Security": [
    "intelligence analyst", "security analyst", "emergency management",
    "federal agent", "investigator",
  ],
  "Emergency Management": [
    "emergency management", "disaster recovery", "preparedness",
    "safety coordinator",
  ],
  "Court Reporting": [
    "court reporter", "transcriptionist", "stenographer",
  ],

  // ----- Hospitality / Tourism / Culinary -----
  "Tourism": [
    "tourism", "travel coordinator", "guest services",
    "event coordinator",
  ],
  "Hotel Management": [
    "hotel manager", "front office", "general manager", "hospitality",
    "guest services",
  ],
  "Culinary Arts": [
    "chef", "cook", "sous chef", "pastry", "kitchen manager",
  ],
  "Event Management": [
    "event manager", "event planner", "event coordinator",
    "meetings planner",
  ],
  "Recreation Management": [
    "recreation coordinator", "parks", "activities director",
    "program coordinator",
  ],
  "Food Service Management": [
    "food service manager", "restaurant manager", "kitchen manager",
    "general manager",
  ],

  // ----- Agriculture / Forestry / Environmental Sciences -----
  "Agriculture": [
    "agronomist", "agricultural", "farm manager", "field technician",
    "extension agent",
  ],
  "Agronomy": [
    "agronomist", "crop", "field technician", "soil",
    "research scientist",
  ],
  "Animal Science": [
    "animal scientist", "livestock", "ranch", "research technician",
    "extension agent",
  ],
  "Horticulture": [
    "horticulturist", "grower", "landscape designer", "nursery manager",
    "greenhouse",
  ],
  "Forestry": [
    "forester", "wildlife biologist", "natural resources",
    "park ranger", "conservation",
  ],
  "Wildlife Biology": [
    "wildlife biologist", "field biologist", "conservation",
    "natural resources",
  ],
  "Environmental Science": [
    "environmental scientist", "field scientist", "sustainability",
    "compliance specialist", "ehs",
  ],
  "Sustainability": [
    "sustainability", "esg analyst", "environmental specialist",
    "compliance", "policy analyst",
  ],
  "Soil Science": [
    "soil scientist", "agronomist", "research scientist",
    "environmental scientist",
  ],

  // ----- Veterinary / Animal Science -----
  "Veterinary Science": [
    "veterinarian", "vet tech", "veterinary assistant",
    "animal care",
  ],
  "Equine Science": [
    "equine", "ranch", "stable manager", "animal care",
  ],
  "Marine Science": [
    "marine biologist", "research scientist", "aquarist",
    "field biologist",
  ],

  // ----- Kinesiology / Sports / Exercise Science -----
  "Kinesiology": [
    "kinesiologist", "athletic trainer", "exercise physiologist",
    "physical therapist", "strength and conditioning",
  ],
  "Exercise Science": [
    "exercise physiologist", "personal trainer", "athletic trainer",
    "strength and conditioning",
  ],
  "Sports Medicine": [
    "athletic trainer", "physical therapist", "sports medicine",
    "rehabilitation",
  ],
  "Recreation and Leisure Studies": [
    "recreation coordinator", "program coordinator", "activities director",
    "parks",
  ],
  "Health and Wellness": [
    "wellness coordinator", "health coach", "personal trainer",
    "wellness program",
  ],
  "Physical Education": [
    "physical education teacher", "pe teacher", "coach",
    "athletic director",
  ],

  // ----- Military / Aviation -----
  "Military Science": [
    "officer", "military", "defense", "intelligence analyst",
    "logistics",
  ],
  "Aviation": [
    "pilot", "flight instructor", "aviation", "air traffic",
    "dispatcher",
  ],
  "Air Traffic Management": [
    "air traffic controller", "atc", "aviation", "flight operations",
  ],
} as const;

// String-literal union of the dropdown options. Used by the Zod schema and
// the combobox UI so adding a new major above flows through to types
// automatically.
export type Major = keyof typeof MAJOR_KEYWORDS;

export const MAJOR_OPTIONS = Object.keys(MAJOR_KEYWORDS) as Major[];
