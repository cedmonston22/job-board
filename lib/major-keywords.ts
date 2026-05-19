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
//
// SUBSTRING-MATCH GOTCHA: the filter is a naive case-insensitive
// `title.includes(keyword)`, so 2-3 character abbreviations leak false
// positives ("rn" matches "intern"/"concern", "pt" matches "captain"/
// "accept", "rt" matches "perform"/"chart", "hr" matches "through"/"three").
// Prefer multi-word phrases ("registered nurse", "physical therap") over
// bare abbreviations. The lists here are deliberately written as a true
// umbrella — Computer Science includes AI/ML/data/research roles, Design
// includes UX/UI/graphic/product, etc. — because that matches how students
// actually shop for jobs against their major.

export const MAJOR_KEYWORDS = {
  // ----- Engineering & Computer Science -----
  "Computer Science": [
    // Core SWE titles
    "software", "engineer", "developer", "swe", "programmer",
    "backend", "frontend", "fullstack", "full-stack", "full stack",
    "web", "mobile", "ios", "android", "devops", "sre",
    "site reliability", "platform", "infrastructure",
    // AI/ML/data/research umbrella — most "X Engineer" titles already
    // hit via "engineer", but scientist-suffix titles ("Applied
    // Scientist", "Research Scientist", "Data Scientist") need explicit
    // entries since bare "scientist" would catch too many lab roles.
    "machine learning", "deep learning", "computer vision", "nlp",
    "applied scientist", "research scientist", "data scientist",
    "data analyst", "ml scientist", "ai/ml",
    // "Research Intern" is the canonical title pattern for Microsoft
    // Research / Google Research / Meta FAIR / Apple ML internships on
    // the Simplify Summer feed — they're nearly all CS/AI roles even
    // though the title doesn't say so. Accepts a few cross-discipline
    // research intern listings as acceptable umbrella spillover.
    "research intern",
    // Security, quality, cloud — sub-disciplines CS grads land in
    "security engineer", "qa engineer", "test engineer",
    "cloud engineer", "solutions engineer", "computer scientist",
  ],
  "Computer Engineering": [
    "computer engineer", "embedded", "firmware", "hardware engineer",
    "systems engineer", "fpga", "asic", "vlsi", "soc",
    "chip designer", "silicon", "verification engineer",
    "microcontroller", "dsp", "embedded software", "embedded systems",
    "hardware designer", "hardware design",
  ],
  "Software Engineering": [
    "software engineer", "software developer", "swe", "developer",
    "engineer", "programmer", "backend", "frontend",
    "full stack", "fullstack", "full-stack", "mobile engineer",
    "web developer", "devops", "sre", "platform engineer",
    "infrastructure engineer", "qa engineer", "test engineer",
    "site reliability",
  ],
  "Data Science": [
    "data scientist", "data engineer", "data analyst", "analytics",
    "machine learning", "ml engineer", "ai engineer",
    "research scientist", "applied scientist", "decision scientist",
    "analytics engineer", "data architect", "ml scientist",
    "deep learning", "computer vision", "nlp",
    "quantitative analyst", "data modeler", "research intern",
  ],
  "Artificial Intelligence": [
    "ai engineer", "machine learning", "ml engineer", "mlops",
    "applied scientist", "research scientist", "nlp",
    "computer vision", "deep learning", "ml scientist",
    "ai researcher", "ai/ml", "generative ai", "llm",
    "ai product", "ai platform", "robotics engineer",
    "prompt engineer", "research intern", "foundation model",
    "agentic", "ml research",
  ],
  "Information Technology": [
    "it support", "system administrator", "sysadmin",
    "network engineer", "network administrator", "help desk",
    "it analyst", "it engineer", "it specialist", "infrastructure",
    "desktop support", "technical support",
    "cloud engineer", "devops",
  ],
  "Information Systems": [
    "business analyst", "systems analyst", "it analyst", "consultant",
    "implementation", "erp", "salesforce", "sap", "workday",
    "business systems", "technical consultant", "technology consultant",
    "technical analyst", "business technology", "mis analyst",
  ],
  "Cybersecurity": [
    "security", "cyber", "penetration", "pentest", "infosec",
    "soc analyst", "incident response", "appsec",
    "security engineer", "security analyst", "security architect",
    "vulnerability", "threat", "red team", "blue team",
    "grc analyst", "iam engineer", "identity engineer", "devsecops",
    "malware", "cyber defense", "cyber risk",
  ],
  "Electrical Engineering": [
    "electrical", "hardware", "firmware", "embedded", "fpga",
    "asic", "rf engineer", "circuit", "signal", "power engineer",
    "analog", "digital design", "semiconductor", "pcb",
    "electronics", "instrumentation", "antenna", "microwave",
    "vlsi", "dsp", "mixed signal", "controls engineer",
  ],
  "Mechanical Engineering": [
    "mechanical", "manufacturing", "robotics", "cad", "mechatronics",
    "controls engineer", "thermal", "design engineer",
    "hvac", "automotive engineer", "mechanical designer",
    "product design engineer", "test engineer", "mechanical systems",
    "tooling engineer", "fluid", "stress analysis",
  ],
  "Civil Engineering": [
    "civil", "structural", "transportation", "geotechnical",
    "construction engineer", "infrastructure",
    "structural engineer", "transportation engineer", "traffic engineer",
    "bridge engineer", "highway", "water resources",
    "hydrology", "surveying", "geomatics", "site engineer",
    "construction inspector",
  ],
  "Chemical Engineering": [
    "chemical engineer", "process engineer", "refinery",
    "pharmaceutical", "polymer", "manufacturing engineer",
    "plant engineer", "formulation", "biochemical engineer",
    "petrochemical", "process development", "process safety",
    "downstream", "upstream processing",
  ],
  "Biomedical Engineering": [
    "biomedical", "medical device", "bioengineer", "tissue", "imaging",
    "biomedical engineer", "biomechanical", "biomaterials",
    "clinical engineer", "regulatory affairs", "fda",
    "biomedical research", "biomedical scientist", "biotech engineer",
  ],
  "Aerospace Engineering": [
    "aerospace", "aeronautical", "astronautical", "flight",
    "propulsion", "spacecraft", "aerospace engineer",
    "aviation engineer", "satellite", "avionics", "structures engineer",
    "gnc engineer", "guidance navigation", "rocket", "mission systems",
    "defense engineer",
  ],
  "Industrial Engineering": [
    "industrial engineer", "operations", "process engineer",
    "supply chain", "logistics", "optimization",
    "manufacturing engineer", "lean", "six sigma",
    "quality engineer", "operations research", "process improvement",
    "production engineer", "industrial designer",
  ],
  "Environmental Engineering": [
    "environmental engineer", "sustainability", "water resources",
    "waste", "remediation", "wastewater",
    "air quality", "environmental scientist", "ehs specialist",
    "environmental compliance", "stormwater", "water engineer",
  ],
  "Materials Science": [
    "materials", "metallurgy", "ceramic", "polymer", "nanomaterials",
    "materials engineer", "materials scientist", "semiconductor",
    "characterization", "failure analysis", "composites",
    "corrosion", "materials development",
  ],
  "Nuclear Engineering": [
    "nuclear", "reactor", "radiation", "health physics", "plasma",
    "nuclear engineer", "radiological", "fusion", "fission",
    "nuclear safety", "reactor engineer", "radiation protection",
  ],
  "Petroleum Engineering": [
    "petroleum", "reservoir", "drilling", "production engineer",
    "completions", "oil and gas", "upstream", "midstream",
    "downstream", "drilling engineer", "reservoir engineer",
    "well engineer", "wellsite",
  ],
  "Agricultural Engineering": [
    "agricultural engineer", "biosystems", "irrigation", "food engineer",
    "biosystems engineer", "ag engineer", "precision agriculture",
    "agritech", "food processing engineer", "agricultural systems",
  ],
  "Systems Engineering": [
    "systems engineer", "integration", "requirements", "test engineer",
    "platform engineer", "systems architect", "mbse",
    "integration engineer", "verification engineer",
    "technical project manager", "systems analyst",
  ],
  "Engineering Management": [
    "engineering manager", "program manager", "project engineer",
    "operations manager", "technical lead", "engineering director",
    "technical program manager", "tpm", "technical manager",
    "head of engineering", "director of engineering",
  ],
  "Robotics": [
    "robotics", "controls", "perception", "slam", "automation",
    "mechatronics", "robotics engineer", "autonomous",
    "motion planning", "manipulation", "computer vision",
    "ros developer", "drone engineer", "autonomy engineer",
  ],
  "Game Design": [
    "game", "gameplay", "level designer", "unity", "unreal",
    "engine programmer", "game designer", "game developer",
    "game programmer", "narrative designer", "tech artist",
    "technical artist", "game artist", "level design",
    "game producer", "game tester",
  ],

  // ----- Physical Sciences -----
  "Physics": [
    "physicist", "research scientist", "optical", "quantum",
    "instrumentation", "applied physicist", "quantum engineer",
    "photonics", "laser engineer", "optical engineer",
    "accelerator", "computational physicist", "medical physicist",
  ],
  "Astronomy": [
    "astronomer", "astrophysicist", "research scientist", "observational",
    "telescope", "astronomy", "astrophysics", "cosmology",
    "planetary scientist", "mission scientist",
  ],
  "Chemistry": [
    "chemist", "research scientist", "analytical chemist",
    "lab", "synthesis", "organic chemist", "inorganic chemist",
    "analytical", "synthetic chemist", "formulation chemist",
    "quality control chemist", "qc chemist", "process chemist",
    "lab technician", "chemistry teacher",
  ],
  "Geology": [
    "geologist", "geoscientist", "field geologist", "hydrogeologist",
    "mining engineer", "exploration", "mining geologist",
    "environmental geologist", "petroleum geologist",
    "geological technician", "wellsite geologist",
  ],
  "Earth Science": [
    "geoscientist", "earth scientist", "field scientist",
    "environmental scientist", "climate scientist",
    "gis analyst", "geospatial analyst", "earth observation",
  ],
  "Meteorology": [
    "meteorologist", "weather forecaster", "atmospheric scientist",
    "climate", "atmospheric researcher", "climatologist",
    "broadcast meteorologist", "weather analyst",
  ],
  "Oceanography": [
    "oceanographer", "marine scientist", "research scientist",
    "hydrographer", "ocean engineer", "marine ecologist",
    "fisheries scientist",
  ],
  "Geophysics": [
    "geophysicist", "seismologist", "exploration geophysicist",
    "research scientist", "seismic interpreter", "well log analyst",
    "geological engineer", "geophysical analyst",
  ],

  // ----- Life Sciences / Biology -----
  "Biology": [
    "biologist", "research scientist", "lab", "scientist",
    "molecular", "genomics", "research associate",
    "biotech", "biological scientist", "lab technician",
    "biology teacher", "science writer",
  ],
  "Biochemistry": [
    "biochemist", "research scientist", "lab", "molecular",
    "protein", "enzyme", "biotech",
    "pharmaceutical scientist", "drug discovery",
    "formulation scientist", "research associate",
  ],
  "Microbiology": [
    "microbiologist", "lab", "research scientist", "qc microbiologist",
    "fermentation", "food microbiologist", "clinical microbiologist",
    "sterility analyst", "environmental monitoring",
    "quality control microbiologist",
  ],
  "Molecular Biology": [
    "molecular biologist", "research scientist", "lab", "genomics",
    "cell biologist", "molecular", "research associate",
    "biotech scientist", "lab technician",
  ],
  "Genetics": [
    "geneticist", "genetic counselor", "research scientist", "genomics",
    "bioinformatics", "molecular geneticist",
    "genomics scientist", "clinical geneticist", "cytogeneticist",
  ],
  "Neuroscience": [
    "neuroscientist", "research scientist", "lab", "neural",
    "cognitive", "neurobiologist", "computational neuroscientist",
    "neuroimaging", "research associate", "neural engineer",
  ],
  "Marine Biology": [
    "marine biologist", "research scientist", "field biologist",
    "aquatic", "fisheries biologist", "aquaculture specialist",
    "conservation biologist",
  ],
  "Ecology": [
    "ecologist", "field biologist", "conservation",
    "environmental scientist", "research scientist",
    "wildlife ecologist", "restoration ecologist",
    "conservation biologist", "environmental consultant", "naturalist",
  ],
  "Zoology": [
    "zoologist", "wildlife biologist", "field biologist", "curator",
    "animal behaviorist", "zookeeper", "wildlife technician",
    "conservation officer",
  ],
  "Botany": [
    "botanist", "plant scientist", "horticulturist", "research scientist",
    "plant biologist", "plant breeder", "conservation botanist",
    "plant pathologist", "plant taxonomist",
  ],
  "Bioinformatics": [
    "bioinformatics", "computational biologist", "data scientist",
    "research scientist", "genomics", "bioinformatician",
    "computational genomics", "biostatistician",
    "bioinformatics engineer",
  ],
  "Biotechnology": [
    "biotech", "research associate", "scientist", "lab",
    "bioprocess", "manufacturing associate", "manufacturing scientist",
    "quality control", "downstream processing", "upstream processing",
    "manufacturing technician", "biopharmaceutical",
  ],

  // ----- Math / Statistics / Quantitative -----
  "Mathematics": [
    "mathematician", "quantitative", "quant", "actuary",
    "statistician", "research scientist", "modeler",
    "math teacher", "applied mathematician",
    "cryptographer", "operations research", "data scientist",
  ],
  "Applied Mathematics": [
    "quantitative", "quant", "modeler", "research scientist",
    "operations research", "applied mathematician",
    "mathematician", "data scientist", "financial engineer",
    "computational mathematician",
  ],
  "Statistics": [
    "statistician", "biostatistician", "data analyst", "analyst",
    "quantitative", "research", "data scientist",
    "statistical analyst", "applied statistician",
    "machine learning", "statistical programmer", "sas programmer",
  ],
  "Actuarial Science": [
    "actuary", "actuarial", "risk analyst", "pricing analyst",
    "actuarial analyst", "insurance analyst",
    "pricing actuary", "reserving actuary", "life actuary",
    "health actuary", "pension actuary",
  ],
  "Data Analytics": [
    "data analyst", "analytics", "bi analyst", "business intelligence",
    "reporting analyst", "analytics engineer", "marketing analyst",
    "product analyst", "data engineer", "sql analyst",
    "tableau", "power bi", "looker analyst",
  ],
  "Business Analytics": [
    "business analyst", "data analyst", "analytics",
    "business intelligence", "bi analyst", "decision scientist",
    "marketing analyst", "operations analyst", "product analyst",
    "financial analyst", "supply chain analyst",
  ],
  "Operations Research": [
    "operations research", "optimization", "supply chain analyst",
    "quantitative analyst", "decision scientist",
    "or analyst", "modeling analyst", "simulation engineer",
    "research scientist",
  ],
  "Quantitative Finance": [
    "quant", "quantitative analyst", "quantitative researcher",
    "trading", "risk analyst", "quant developer",
    "quant trader", "derivatives", "algo trading",
    "algorithmic trading", "financial engineer",
    "quantitative strategist",
  ],

  // ----- Business / Finance / Accounting -----
  "Business Administration": [
    "business analyst", "business operations", "chief of staff",
    "strategy", "general manager", "consultant", "mba",
    "associate consultant", "business development",
    "bizops", "rotational program", "leadership program",
    "management trainee", "operations associate",
  ],
  "Finance": [
    "finance", "financial analyst", "investment", "banking",
    "trading", "portfolio", "treasury", "audit", "actuary",
    "corporate finance", "fp&a", "financial planning",
    "m&a", "private equity", "venture capital",
    "investment banking", "equity research",
    "sales and trading", "financial advisor", "wealth management",
  ],
  "Accounting": [
    "accountant", "audit", "auditor", "tax", "controller",
    "bookkeeper", "cpa", "accounting", "staff accountant",
    "senior accountant", "financial reporting", "internal audit",
    "external audit", "payroll", "accounts payable",
    "accounts receivable",
  ],
  "Management": [
    "general manager", "operations manager", "business manager",
    "program manager", "project manager", "management consultant",
    "chief of staff", "management trainee",
    "leadership development", "rotational program",
    "store manager", "district manager", "regional manager",
    "account manager",
  ],
  "Supply Chain Management": [
    "supply chain", "logistics", "procurement", "operations",
    "warehouse", "fulfillment", "demand planner", "sourcing",
    "inventory", "distribution", "transportation",
    "materials management", "planning analyst",
  ],
  "International Business": [
    "international", "global", "trade", "consultant", "associate",
    "international business", "global trade",
    "import export", "international sales", "international marketing",
    "global operations", "market expansion",
  ],
  "Entrepreneurship": [
    "founder", "co-founder", "venture", "startup", "associate",
    "business development", "founding engineer", "founding",
    "venture capital", "chief of staff", "go to market",
    "growth", "biz dev",
  ],
  "Human Resources": [
    "human resources", "people", "talent", "recruiter",
    "people operations", "hr generalist", "hr business partner",
    "hrbp", "total rewards", "compensation analyst",
    "benefits analyst", "learning and development",
    "diversity equity inclusion", "hris analyst",
  ],
  "Real Estate": [
    "real estate", "broker", "property manager", "leasing",
    "appraiser", "asset manager", "real estate analyst",
    "real estate associate", "acquisitions",
    "development associate", "commercial real estate",
    "residential", "mortgage", "escrow officer",
  ],
  "Hospitality Management": [
    "hospitality", "hotel manager", "restaurant manager", "event manager",
    "food and beverage", "hospitality coordinator",
    "front office", "guest services", "banquet manager",
    "catering manager",
  ],
  "Sports Management": [
    "sports", "athletic", "event coordinator", "operations",
    "sponsorship", "sports management", "sports marketing",
    "athletic coordinator", "sponsorship coordinator",
    "sports analytics", "sports operations", "athletic operations",
  ],
  "Investment Management": [
    "investment", "portfolio manager", "asset manager",
    "wealth manager", "research analyst",
    "investment analyst", "investment associate",
    "portfolio analyst", "asset management", "hedge fund",
    "private equity", "mutual fund", "equity research",
  ],
  "Risk Management": [
    "risk analyst", "risk manager", "compliance", "underwriter",
    "credit analyst", "risk management",
    "operational risk", "market risk", "credit risk",
    "enterprise risk", "model risk", "risk associate",
    "risk consultant",
  ],
  "Insurance": [
    "underwriter", "claims adjuster", "insurance", "actuary",
    "risk analyst", "insurance underwriter",
    "insurance analyst", "insurance broker", "claims examiner",
    "property casualty", "life insurance", "health insurance",
    "insurance agent",
  ],
  "Banking": [
    "banking", "credit analyst", "loan officer", "branch manager",
    "investment banking", "commercial banking",
    "retail banking", "private banking", "banking analyst",
    "banking associate", "relationship manager", "treasury analyst",
    "banker",
  ],
  "Operations Management": [
    "operations manager", "operations analyst", "process improvement",
    "supply chain", "logistics", "operations associate",
    "operations director", "operations coordinator",
    "operations specialist", "business operations", "plant manager",
    "production manager",
  ],
  "Project Management": [
    "project manager", "program manager", "scrum master",
    "project coordinator", "pmp certified", "technical project manager",
    "project lead", "scrum", "agile coach", "project administrator",
    "project specialist",
  ],
  "Logistics": [
    "logistics", "supply chain", "warehouse", "distribution",
    "fulfillment", "logistics coordinator", "logistics analyst",
    "logistics manager", "transportation", "freight", "shipping",
    "fleet manager",
  ],
  "Organizational Behavior": [
    "organizational development", "talent", "people operations",
    "consultant", "organizational behavior", "change management",
    "learning and development", "organizational effectiveness",
    "leadership development", "hr consultant",
  ],
  "Taxation": [
    "tax", "tax analyst", "tax accountant", "cpa", "tax consultant",
    "tax associate", "tax manager", "tax director",
    "international tax", "corporate tax", "tax preparer",
    "sales tax", "transfer pricing",
  ],

  // ----- Marketing / Advertising / Communications -----
  "Marketing": [
    "marketing", "brand", "growth", "seo", "sem", "advertising",
    "content", "social media", "communications",
    "marketing manager", "marketing coordinator", "marketing specialist",
    "product marketing", "email marketing", "lifecycle marketing",
    "demand generation", "marketing analyst", "growth marketing",
  ],
  "Advertising": [
    "advertising", "account executive", "media planner", "copywriter",
    "creative", "brand", "advertising account",
    "account manager", "ad ops", "ad operations",
    "media buyer", "account coordinator", "creative director",
    "ad sales",
  ],
  "Public Relations": [
    "public relations", "communications", "media relations", "publicist",
    "pr specialist", "pr coordinator", "pr manager",
    "corporate communications", "internal communications",
    "crisis communications", "spokesperson",
  ],
  "Communications": [
    "communications", "public relations", "writer", "content",
    "media", "marketing", "communications specialist",
    "communications manager", "communications coordinator",
    "communications director", "internal communications",
    "executive communications",
  ],
  "Digital Marketing": [
    "digital marketing", "seo", "sem", "growth", "performance marketing",
    "social media", "marketing analyst", "paid media",
    "paid search", "paid social", "content marketing",
    "email marketing", "marketing automation", "conversion rate",
    "crm marketing", "marketing technology",
  ],
  "Journalism": [
    "journalist", "reporter", "writer", "editor", "content",
    "media", "communications", "news reporter",
    "news anchor", "news producer", "copy editor",
    "staff writer", "investigative reporter", "multimedia journalist",
  ],
  "Media Studies": [
    "media", "content", "producer", "communications", "social media",
    "media planner", "media buyer", "content creator",
    "content strategist", "social media manager",
  ],
  "Broadcasting": [
    "broadcast", "producer", "anchor", "reporter", "media",
    "videographer", "broadcasting", "news producer",
    "news anchor", "broadcast journalist", "broadcast engineer",
    "on-air talent",
  ],
  "Strategic Communication": [
    "communications", "public relations", "brand", "content strategist",
    "marketing", "strategic communications",
    "corporate communications", "brand strategist",
    "communications strategist",
  ],

  // ----- Economics / Public Policy -----
  "Economics": [
    "economist", "research analyst", "policy analyst", "data analyst",
    "consulting", "research", "applied economist",
    "research assistant", "federal reserve", "treasury analyst",
    "consulting analyst", "business economist", "economic analyst",
  ],
  "International Relations": [
    "international", "policy", "foreign", "diplomatic", "consultant",
    "analyst", "advisor", "international relations",
    "foreign service", "foreign policy", "geopolitical analyst",
    "intelligence analyst", "international development",
    "ngo", "global affairs",
  ],
  "Public Policy": [
    "policy", "public", "government", "legislative", "advocacy",
    "analyst", "policy analyst", "policy advisor",
    "government affairs", "regulatory affairs", "think tank",
    "research analyst", "policy associate",
  ],
  "Public Administration": [
    "public administration", "government", "city manager", "policy",
    "program manager", "nonprofit", "city planner",
    "public sector", "civic", "program coordinator",
    "grants manager", "policy analyst",
  ],
  "Political Science": [
    "policy", "political", "government", "legislative", "advocacy",
    "consultant", "analyst", "political analyst",
    "campaign manager", "legislative aide", "lobbyist",
    "government affairs", "political consultant",
  ],
  "Government": [
    "government", "policy", "legislative", "public affairs",
    "civil servant", "government relations",
    "regulatory", "government contracts", "federal", "state government",
    "municipal",
  ],
  "Urban Studies": [
    "urban planner", "city planner", "policy analyst",
    "community development", "transportation planner",
    "urban designer", "urban policy", "planning analyst",
    "housing analyst", "neighborhood",
  ],
  "Development Studies": [
    "international development", "policy analyst", "program manager",
    "nonprofit", "research analyst", "ngo",
    "peace corps", "aid worker", "program coordinator",
    "foundations associate",
  ],

  // ----- Pre-Med / Health Sciences / Nursing -----
  "Pre-Medicine": [
    "medical scribe", "clinical research", "research assistant",
    "lab technician", "emt", "paramedic", "medical assistant",
    "patient care", "clinical assistant", "healthcare assistant",
    "biomedical research", "hospital",
  ],
  "Nursing": [
    "nurse", "nursing", "clinical", "registered nurse",
    "licensed practical nurse", "lpn", "nurse practitioner",
    "nurse manager", "charge nurse", "icu nurse",
    "ed nurse", "or nurse", "oncology nurse",
    "cna", "certified nursing",
  ],
  "Public Health": [
    "public health", "epidemiologist", "health analyst",
    "community health", "research", "policy",
    "mph", "health educator", "public health analyst",
    "health policy", "infection control", "biostatistics",
    "global health", "environmental health",
  ],
  "Health Sciences": [
    "clinical research", "clinical coordinator", "health educator",
    "patient navigator", "medical assistant", "healthcare analyst",
    "health sciences", "clinical research coordinator",
    "clinical research associate", "clinical operations",
    "health technology",
  ],
  "Health Administration": [
    "healthcare administrator", "practice manager", "health policy",
    "hospital administrator", "operations",
    "health administration", "healthcare manager",
    "healthcare operations", "revenue cycle", "practice administrator",
    "healthcare consultant",
  ],
  "Pharmacy": [
    "pharmacist", "pharmacy technician", "clinical pharmacist",
    "pharmaceutical", "retail pharmacist", "hospital pharmacist",
    "pharmacy manager", "pharmacy director", "ambulatory pharmacist",
    "pharmacy intern",
  ],
  "Pharmaceutical Sciences": [
    "pharmaceutical", "pharmacology", "research scientist",
    "drug development", "formulation",
    "pharmaceutical scientist", "drug discovery",
    "regulatory affairs", "clinical pharmacology",
    "pharmaceutical research", "qa pharmaceutical",
  ],
  "Dental Hygiene": [
    "dental hygienist", "dental assistant", "dental",
    "registered dental hygienist", "rdh", "dental office",
    "dental practice",
  ],
  "Physical Therapy": [
    "physical therapist", "physical therapy", "rehabilitation",
    "athletic trainer", "dpt", "physical therapist assistant",
    "rehabilitation therapist", "sports medicine",
  ],
  "Occupational Therapy": [
    "occupational therapist", "occupational therapy", "rehabilitation",
    "occupational therapy assistant", "hand therapist", "pediatric ot",
  ],
  "Speech Pathology": [
    "speech pathologist", "speech therapist", "slp",
    "communication disorders", "speech-language pathologist",
    "speech language pathologist", "audiologist", "speech-language",
  ],
  "Radiologic Technology": [
    "radiologic technologist", "rad tech", "mri technologist",
    "ct technologist", "x-ray", "radiology technologist",
    "imaging technologist", "sonographer", "ultrasound technologist",
    "nuclear medicine technologist", "mammography",
  ],
  "Respiratory Therapy": [
    "respiratory therapist", "respiratory therapy", "pulmonary",
    "respiratory care", "neonatal respiratory",
    "critical care respiratory",
  ],
  "Medical Laboratory Science": [
    "medical laboratory", "lab technician", "medical technologist",
    "clinical lab", "medical laboratory scientist",
    "clinical laboratory technologist", "blood bank technologist",
    "microbiology technologist",
  ],
  "Nutrition": [
    "nutritionist", "dietitian", "food scientist", "health coach",
    "registered dietitian", "clinical dietitian",
    "sports nutritionist", "public health nutritionist",
    "nutrition educator",
  ],
  "Dietetics": [
    "dietitian", "nutritionist", "clinical dietitian",
    "registered dietitian", "dietetics",
    "clinical nutrition", "food service director",
    "dietetic technician",
  ],
  "Athletic Training": [
    "athletic trainer", "rehabilitation", "strength and conditioning",
    "sports medicine", "athletic training",
    "certified athletic trainer", "sports performance",
    "physical therapy assistant",
  ],
  "Epidemiology": [
    "epidemiologist", "public health", "biostatistician",
    "research scientist", "disease investigator",
    "epidemiology", "infectious disease", "chronic disease",
    "surveillance analyst", "outbreak investigator",
    "cdc analyst", "health department",
  ],
  "Health Informatics": [
    "health informatics", "clinical informatics", "ehr", "epic analyst",
    "healthcare data analyst", "clinical informatics specialist",
    "nursing informatics", "healthcare it", "hl7",
    "fhir analyst", "healthcare data", "ehr analyst",
    "cerner analyst", "epic consultant",
  ],

  // ----- Education -----
  "Education": [
    "teacher", "educator", "instructional designer", "curriculum",
    "tutor", "trainer", "learning", "education",
    "education specialist", "education coordinator",
    "education consultant", "teaching assistant",
    "paraprofessional", "school",
  ],
  "Elementary Education": [
    "elementary teacher", "teacher", "educator", "curriculum",
    "instructional", "elementary education",
    "k-5 teacher", "k-6 teacher", "classroom teacher",
    "elementary school",
  ],
  "Secondary Education": [
    "high school teacher", "teacher", "educator", "curriculum",
    "instructional", "secondary education", "middle school teacher",
    "math teacher", "science teacher", "english teacher",
    "history teacher", "social studies teacher",
  ],
  "Special Education": [
    "special education", "sped teacher", "behavior specialist",
    "teacher", "paraprofessional", "autism specialist",
    "learning specialist", "intervention specialist",
    "special needs", "behavior analyst",
  ],
  "Early Childhood Education": [
    "early childhood", "preschool teacher", "daycare", "teacher",
    "child development", "early childhood education",
    "head start", "child care", "infant teacher",
    "toddler teacher", "preschool director",
  ],
  "Curriculum and Instruction": [
    "curriculum", "instructional designer", "instructional coach",
    "education specialist", "curriculum specialist",
    "curriculum developer", "curriculum coordinator",
    "education coordinator",
  ],
  "Educational Leadership": [
    "principal", "assistant principal", "school administrator",
    "instructional coach", "dean of students",
    "educational leadership", "superintendent",
    "head of school", "school director", "education director",
    "academic dean",
  ],
  "Educational Technology": [
    "instructional designer", "edtech", "learning experience",
    "lms administrator", "training",
    "educational technology", "edtech specialist",
    "e-learning developer", "learning experience designer",
    "training developer", "technology integration",
  ],
  "Counselor Education": [
    "school counselor", "guidance counselor", "academic advisor",
    "counselor", "college counselor", "academic counselor",
    "student services", "student affairs", "advisor",
  ],
  "Library Science": [
    "librarian", "library", "archivist", "information specialist",
    "library science", "public librarian", "school librarian",
    "academic librarian", "reference librarian",
    "information science",
  ],

  // ----- Psychology / Social Work -----
  "Psychology": [
    "psychologist", "research assistant", "counselor", "therapist",
    "behavioral", "user research", "ux research", "psychology",
    "clinical psychologist", "school psychologist",
    "industrial organizational", "psychometrist",
    "behavioral health technician",
  ],
  "Clinical Psychology": [
    "clinical psychologist", "therapist", "counselor",
    "mental health", "behavioral", "clinical psychology",
    "licensed clinical psychologist", "psychological associate",
    "mental health therapist", "psychotherapist",
  ],
  "Cognitive Science": [
    "cognitive scientist", "ux researcher", "user research",
    "research scientist", "data scientist", "cognitive science",
    "computational cognitive", "human computer interaction",
    "ai researcher",
  ],
  "Behavioral Science": [
    "behavioral scientist", "user research", "research analyst",
    "behavior analyst", "behavioral science",
    "applied behavior analysis", "bcba",
    "behavioral health", "behavioral economics",
  ],
  "Counseling": [
    "counselor", "therapist", "mental health", "case manager",
    "behavioral health", "counseling", "lpc",
    "lcsw", "lmft", "mental health counselor",
    "addiction counselor", "family therapist",
    "marriage counselor", "school counselor",
  ],
  "Social Work": [
    "social worker", "case manager", "msw", "lcsw",
    "behavioral health", "community", "social work",
    "clinical social worker", "medical social worker",
    "school social worker", "family services",
    "child welfare", "csw",
  ],
  "Human Services": [
    "case manager", "social worker", "community", "nonprofit",
    "program coordinator", "human services",
    "family services", "community health worker",
    "outreach worker", "intake coordinator", "social services",
  ],
  "Child Development": [
    "child development specialist", "early childhood", "preschool",
    "behavioral", "child development", "developmental specialist",
    "child life specialist", "family services", "early intervention",
  ],
  "Gerontology": [
    "geriatric", "case manager", "social worker", "activities director",
    "gerontology", "geriatric care manager", "elder care",
    "senior services", "hospice", "assisted living",
  ],

  // ----- Sociology / Anthropology / Political Science -----
  "Sociology": [
    "sociologist", "policy analyst", "research analyst", "community",
    "advocacy", "social research", "qualitative researcher",
    "market researcher", "research associate", "social services",
  ],
  "Anthropology": [
    "anthropologist", "ux researcher", "user research",
    "cultural", "design researcher", "ethnographer",
    "cultural researcher", "qualitative researcher", "archaeology",
  ],
  "Archaeology": [
    "archaeologist", "field technician", "cultural resource",
    "researcher", "archaeology", "field archaeologist",
    "cultural resource management", "lab archaeologist", "museum",
  ],
  "Criminology": [
    "criminologist", "research analyst", "policy analyst", "investigator",
    "intelligence analyst", "criminology",
    "crime analyst", "criminal justice researcher",
    "victims advocate", "forensic researcher",
  ],
  "Demography": [
    "demographer", "research analyst", "data analyst", "policy analyst",
    "demography", "population research", "census analyst",
    "demographic analyst", "statistician",
  ],
  "Geography": [
    "geographer", "gis analyst", "cartographer", "urban planner",
    "spatial analyst", "gis specialist", "gis developer",
    "geospatial analyst", "geographic information systems",
    "remote sensing",
  ],
  "Ethnic Studies": [
    "policy analyst", "community", "advocacy", "diversity",
    "ethnic studies", "diversity equity inclusion",
    "community organizer", "social justice", "dei specialist",
  ],
  "Women's Studies": [
    "advocacy", "policy analyst", "nonprofit", "community",
    "women's studies", "gender studies", "diversity",
    "diversity equity inclusion", "victims advocate",
    "sexual assault advocate",
  ],

  // ----- Humanities -----
  "English": [
    "writer", "editor", "content", "copywriter", "journalist",
    "communications", "english teacher", "technical writer",
    "content writer", "editorial", "proofreader",
    "publishing", "content strategist", "communications specialist",
  ],
  "Creative Writing": [
    "writer", "copywriter", "editor", "content", "screenwriter",
    "creative writing", "author", "novelist", "content creator",
    "fiction editor", "narrative designer",
  ],
  "Literature": [
    "writer", "editor", "researcher", "content", "publishing",
    "literature teacher", "literary agent", "publishing assistant",
    "editorial assistant", "book editor",
  ],
  "Comparative Literature": [
    "writer", "editor", "translator", "literary translator",
    "editorial", "academic publishing", "literary agent",
  ],
  "Linguistics": [
    "linguist", "computational linguist", "nlp", "language specialist",
    "translator", "linguistics", "language engineer",
    "speech scientist", "lexicographer", "technical linguist",
  ],
  "History": [
    "historian", "archivist", "curator", "museum",
    "librarian", "historical researcher", "public historian",
    "history teacher", "historical preservation",
  ],
  "Art History": [
    "curator", "gallery", "archivist", "art historian", "researcher",
    "art history", "museum", "art gallery",
    "curatorial assistant", "art conservation", "registrar",
  ],
  "Philosophy": [
    "associate", "consultant", "writer", "philosophy teacher",
    "ethicist", "ethics analyst", "ai ethics",
    "policy analyst", "research analyst", "paralegal",
  ],
  "Religious Studies": [
    "chaplain", "minister", "nonprofit", "writer",
    "religious studies", "ministry coordinator",
    "theology", "faith-based", "religious educator",
  ],
  "Theology": [
    "chaplain", "minister", "pastor", "nonprofit", "researcher",
    "theology", "theological", "ministry", "pastoral",
    "divinity", "seminary",
  ],
  "Classics": [
    "writer", "editor", "curator", "archivist",
    "classics", "classical studies", "latin teacher",
    "greek teacher", "museum", "librarian", "academic researcher",
  ],
  "French": [
    "translator", "interpreter", "language specialist", "international",
    "french teacher", "french translator", "localization",
    "bilingual french", "french specialist",
  ],
  "Spanish": [
    "translator", "interpreter", "language specialist", "bilingual",
    "spanish teacher", "spanish translator",
    "esl teacher", "bilingual specialist", "localization specialist",
  ],
  "German": [
    "translator", "interpreter", "language specialist", "international",
    "german teacher", "german translator", "localization",
    "bilingual german",
  ],
  "Chinese": [
    "translator", "interpreter", "mandarin", "language specialist",
    "international", "chinese teacher", "chinese translator",
    "mandarin teacher", "mandarin translator", "bilingual chinese",
  ],
  "Japanese": [
    "translator", "interpreter", "language specialist", "international",
    "localization", "japanese teacher", "japanese translator",
    "bilingual japanese", "japanese specialist",
  ],
  "Arabic": [
    "translator", "interpreter", "language specialist",
    "intelligence analyst", "linguist", "arabic translator",
    "arabic teacher", "bilingual arabic", "arabic linguist",
  ],
  "Russian": [
    "translator", "interpreter", "language specialist",
    "intelligence analyst", "linguist", "russian translator",
    "russian teacher", "bilingual russian",
  ],
  "African American Studies": [
    "policy analyst", "community", "advocacy", "diversity",
    "african american studies", "black studies",
    "diversity equity inclusion", "community organizer",
  ],

  // ----- Arts -----
  "Design": [
    "designer", "product designer", "graphic designer",
    "visual designer", "ux designer", "ui designer",
    "ux/ui", "ui/ux", "brand designer", "motion designer",
    "design lead", "design director", "interaction designer",
    "design researcher", "design ops",
  ],
  "Graphic Design": [
    "graphic designer", "visual designer", "designer", "brand",
    "creative", "illustration", "graphic design",
    "junior designer", "senior designer", "graphic artist",
    "print designer", "packaging designer",
  ],
  "Fine Arts": [
    "artist", "illustrator", "designer", "curator", "art director",
    "fine arts", "gallery", "museum", "art teacher",
    "studio artist", "exhibitions",
  ],
  "Illustration": [
    "illustrator", "concept artist", "designer", "graphic designer",
    "visual designer", "illustration",
    "character artist", "storyboard artist", "editorial illustrator",
    "technical illustrator",
  ],
  "Photography": [
    "photographer", "videographer", "photo editor", "content creator",
    "visual", "photography", "photo assistant", "photo retoucher",
    "studio photographer", "commercial photographer", "photojournalist",
  ],
  "Animation": [
    "animator", "motion designer", "3d artist", "rigging artist",
    "vfx artist", "animation",
    "2d animator", "3d animator", "character animator",
    "animation artist", "motion graphics", "technical animator",
  ],
  "Film & Media": [
    "filmmaker", "producer", "director", "editor", "videographer",
    "cinematographer", "media", "content",
    "film editor", "post production", "production assistant",
    "video editor", "production coordinator",
  ],
  "Theater": [
    "actor", "stage manager", "production assistant", "theater",
    "casting", "theatre", "scenic designer", "lighting designer",
    "sound designer", "stagehand", "costume designer",
  ],
  "Dance": [
    "dancer", "choreographer", "dance instructor", "performer",
    "dance teacher", "ballet", "contemporary dancer",
    "dance therapist",
  ],
  "Music": [
    "musician", "composer", "audio engineer", "sound engineer",
    "music director", "music producer", "music teacher",
    "music therapist", "music technology", "production engineer",
  ],
  "Music Education": [
    "music teacher", "band director", "choir director", "music instructor",
    "music education", "music director", "orchestra director",
    "vocal director",
  ],
  "Fashion Design": [
    "fashion designer", "apparel designer", "technical designer",
    "stylist", "buyer", "fashion",
    "fashion merchandiser", "fashion design assistant",
    "pattern maker", "garment", "apparel",
  ],

  // ----- Architecture / Urban Planning / Design -----
  "Architecture": [
    "architect", "architectural", "designer", "draftsperson",
    "urban planner", "interior", "junior architect",
    "project architect", "architectural designer", "bim specialist",
    "revit designer", "architectural intern",
  ],
  "Landscape Architecture": [
    "landscape architect", "designer", "urban planner",
    "site planner", "landscape designer",
    "landscape architectural designer", "parks designer",
    "environmental designer",
  ],
  "Interior Design": [
    "interior designer", "designer", "space planner",
    "furniture designer", "interior design",
    "interior architect", "interiors", "residential designer",
    "commercial designer", "hospitality designer",
  ],
  "Urban Planning": [
    "urban planner", "city planner", "transportation planner",
    "community development", "policy analyst", "urban planning",
    "planning analyst", "planner", "gis planner",
    "environmental planner",
  ],
  "Construction Management": [
    "construction manager", "project manager", "estimator",
    "superintendent", "project engineer", "construction management",
    "construction administrator", "field engineer",
    "assistant project manager", "construction coordinator",
    "project controls",
  ],
  "Industrial Design": [
    "industrial designer", "product designer", "designer",
    "design engineer", "industrial design",
    "product design", "hardware designer", "footwear designer",
    "consumer product designer",
  ],
  "Environmental Design": [
    "designer", "urban planner", "landscape architect",
    "sustainability", "environmental design",
    "environmental graphic designer", "sustainable design",
    "exhibit designer",
  ],

  // ----- Law / Criminal Justice / Public Administration -----
  "Pre-Law": [
    "paralegal", "legal assistant", "law clerk", "compliance analyst",
    "policy analyst", "legal intern", "contracts administrator",
    "legal coordinator", "compliance specialist",
  ],
  "Paralegal Studies": [
    "paralegal", "legal assistant", "law clerk", "contracts",
    "litigation paralegal", "corporate paralegal",
    "ip paralegal", "contracts paralegal", "legal secretary",
    "contract administrator",
  ],
  "Criminal Justice": [
    "police officer", "detective", "probation officer",
    "corrections officer", "investigator", "criminologist",
    "criminal justice", "law enforcement", "sheriff deputy",
    "parole officer", "federal agent", "security officer",
    "security analyst",
  ],
  "Forensic Science": [
    "forensic scientist", "crime scene", "forensic analyst",
    "lab technician", "dna analyst", "forensic science",
    "crime laboratory", "ballistics", "latent print",
    "toxicology", "csi", "forensic toxicologist",
  ],
  "Homeland Security": [
    "intelligence analyst", "security analyst", "emergency management",
    "federal agent", "investigator", "homeland security",
    "dhs analyst", "cbp officer", "customs", "border patrol",
    "fbi", "defense analyst", "counter terrorism",
  ],
  "Emergency Management": [
    "emergency management", "disaster recovery", "preparedness",
    "safety coordinator", "emergency management specialist",
    "emergency manager", "fema", "emergency response",
    "business continuity", "crisis management",
  ],
  "Court Reporting": [
    "court reporter", "transcriptionist", "stenographer",
    "court reporting", "freelance court reporter",
    "captioner", "real time reporter",
  ],

  // ----- Hospitality / Tourism / Culinary -----
  "Tourism": [
    "tourism", "travel coordinator", "guest services",
    "event coordinator", "travel agent", "tour guide",
    "tour operator", "hospitality coordinator", "destination marketing",
  ],
  "Hotel Management": [
    "hotel manager", "front office", "general manager", "hospitality",
    "guest services", "hotel management", "hotel operations",
    "hotel director", "food and beverage", "hotel intern",
  ],
  "Culinary Arts": [
    "chef", "cook", "sous chef", "pastry", "kitchen manager",
    "culinary", "executive chef", "line cook", "prep cook",
    "pastry chef", "baker", "culinary instructor",
  ],
  "Event Management": [
    "event manager", "event planner", "event coordinator",
    "meetings planner", "event management",
    "conference planner", "wedding planner",
    "special events coordinator", "events specialist",
  ],
  "Recreation Management": [
    "recreation coordinator", "parks", "activities director",
    "program coordinator", "recreation management",
    "recreation supervisor", "recreation specialist",
    "parks and recreation", "leisure management",
  ],
  "Food Service Management": [
    "food service manager", "restaurant manager", "kitchen manager",
    "general manager", "food service", "dining manager",
    "restaurant operations", "food service director", "foodservice",
    "hospitality",
  ],

  // ----- Agriculture / Forestry / Environmental Sciences -----
  "Agriculture": [
    "agronomist", "agricultural", "farm manager", "field technician",
    "extension agent", "agriculture",
    "agricultural specialist", "agriculture technician",
    "farm operations", "agribusiness", "ag economist",
  ],
  "Agronomy": [
    "agronomist", "crop", "field technician", "soil",
    "research scientist", "agronomy", "crop consultant",
    "agronomic", "agronomy intern", "crop scientist",
  ],
  "Animal Science": [
    "animal scientist", "livestock", "ranch", "research technician",
    "extension agent", "animal science", "animal husbandry",
    "dairy specialist", "livestock manager", "swine specialist",
    "poultry specialist", "animal nutritionist",
  ],
  "Horticulture": [
    "horticulturist", "grower", "landscape designer", "nursery manager",
    "greenhouse", "horticulture", "gardener",
    "garden designer", "plant care specialist", "viticulture",
    "arborist",
  ],
  "Forestry": [
    "forester", "wildlife biologist", "natural resources",
    "park ranger", "conservation", "forestry",
    "forest technician", "urban forester", "timber management",
    "forest ecology",
  ],
  "Wildlife Biology": [
    "wildlife biologist", "field biologist", "conservation",
    "natural resources", "wildlife", "wildlife technician",
    "wildlife manager", "wildlife ecologist", "fisheries biologist",
  ],
  "Environmental Science": [
    "environmental scientist", "field scientist", "sustainability",
    "compliance specialist", "ehs specialist",
    "environmental science", "environmental consultant",
    "environmental engineer", "environmental analyst",
    "environmental health",
  ],
  "Sustainability": [
    "sustainability", "esg analyst", "environmental specialist",
    "compliance", "policy analyst", "sustainability manager",
    "esg", "sustainability consultant", "climate analyst",
    "carbon analyst", "sustainable", "circular economy",
    "decarbonization",
  ],
  "Soil Science": [
    "soil scientist", "agronomist", "research scientist",
    "environmental scientist", "soil science",
    "soil conservation", "soil and water", "soil analyst",
    "geotechnical",
  ],

  // ----- Veterinary / Animal Science -----
  "Veterinary Science": [
    "veterinarian", "vet tech", "veterinary assistant",
    "animal care", "veterinary", "vet technician",
    "dvm", "veterinary nurse", "vet receptionist",
    "animal hospital",
  ],
  "Equine Science": [
    "equine", "ranch", "stable manager", "animal care",
    "equine science", "horse trainer", "riding instructor",
    "equestrian", "equine veterinary technician",
  ],
  "Marine Science": [
    "marine biologist", "research scientist", "aquarist",
    "field biologist", "marine science",
    "marine technician", "marine ecology", "oceanographer",
    "aquaculture",
  ],

  // ----- Kinesiology / Sports / Exercise Science -----
  "Kinesiology": [
    "kinesiologist", "athletic trainer", "exercise physiologist",
    "physical therapist", "strength and conditioning",
    "kinesiology", "exercise specialist", "sports performance",
    "biomechanist", "exercise scientist", "movement specialist",
  ],
  "Exercise Science": [
    "exercise physiologist", "personal trainer", "athletic trainer",
    "strength and conditioning", "exercise science",
    "fitness specialist", "wellness coach", "sports performance",
    "exercise instructor", "group fitness",
  ],
  "Sports Medicine": [
    "athletic trainer", "physical therapist", "sports medicine",
    "rehabilitation", "sports medicine physician",
    "certified athletic trainer", "athletic performance",
    "sports rehabilitation", "sports therapist",
  ],
  "Recreation and Leisure Studies": [
    "recreation coordinator", "program coordinator", "activities director",
    "parks", "recreation", "leisure studies",
    "leisure coordinator", "parks coordinator", "camp director",
    "youth program",
  ],
  "Health and Wellness": [
    "wellness coordinator", "health coach", "personal trainer",
    "wellness program", "health and wellness",
    "wellness consultant", "wellness specialist", "workplace wellness",
    "corporate wellness", "fitness director",
  ],
  "Physical Education": [
    "physical education teacher", "pe teacher", "coach",
    "athletic director", "physical education",
    "health and physical education", "fitness instructor",
    "gym teacher",
  ],

  // ----- Military / Aviation -----
  "Military Science": [
    "officer", "military", "defense", "intelligence analyst",
    "logistics", "military science", "army officer",
    "navy officer", "air force officer", "defense contractor",
    "military intelligence", "rotc instructor",
  ],
  "Aviation": [
    "pilot", "flight instructor", "aviation", "air traffic",
    "dispatcher", "airline pilot", "commercial pilot",
    "aviation maintenance", "flight attendant",
    "aviation safety", "aviation operations",
  ],
  "Air Traffic Management": [
    "air traffic controller", "air traffic", "aviation",
    "flight operations", "air traffic management",
    "air traffic specialist", "faa", "airport operations",
    "airspace", "terminal radar",
  ],
} as const;

// String-literal union of the dropdown options. Used by the Zod schema and
// the combobox UI so adding a new major above flows through to types
// automatically.
export type Major = keyof typeof MAJOR_KEYWORDS;

export const MAJOR_OPTIONS = Object.keys(MAJOR_KEYWORDS) as Major[];
