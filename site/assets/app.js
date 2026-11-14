(function () {
  "use strict";

  var API = "api/index.php";
  var previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
  var demo = { nextId: 10, nextMilestone: 1 };
  var state = {
    csrf: "",
    user: null,
    profile: null,
    subscription: null,
    opportunities: [],
    projects: [],
    proposals: [],
    learnings: [],
    activity: [],
    users: [],
    latestDiscovery: null,
    tab: "dashboard",
    search: "",
    stage: "",
    sector: "",
    activeOpportunity: null,
    activeProposal: null,
    interviewQuestions: [],
    sourceCapability: "learning",
    sourceMarket: "east",
  };
  var stageList = [
    ["Discovered", "New signal"],
    ["GoNoGo", "Decision"],
    ["Drafting", "Drafting"],
    ["Review", "In review"],
    ["Submitted", "Submitted"],
    ["Won", "Won"],
    ["Lost", "Lost"],
    ["NoGo", "No-go"],
  ];
  state.learnings = [];
  var pageNames = {
    dashboard: "Executive brief",
    opportunities: "Opportunity radar",
    pipeline: "Bid pipeline",
    reports: "Portfolio report",
    proposal: "Proposal studio",
    interview: "Interview room",
    delivery: "Project launch",
    learnings: "Learning review",
    profile: "Company evidence",
    team: "Team access",
  };
  var sourceKeywordGroups = {
    learning: {
      label: "Digital learning & instructional design",
      terms: ["digital learning", "e-learning", "elearning", "online learning", "instructional design", "course development", "microlearning", "learning content", "training platform", "SCORM", "xAPI"].map(function (term) { return '"' + term + '"'; }),
    },
    lms: {
      label: "LMS & learning technology",
      terms: ["learning management system", "LMS", "SCORM", "xAPI", "LMS implementation", "LMS migration", "LMS hosting", "learning platform", "digital learning platform"].map(function (term) { return '"' + term + '"'; }),
    },
    cloud: {
      label: "Cloud & cybersecurity",
      terms: ["cloud migration", "cloud services", "cloud managed services", "cybersecurity", "cybersecurity assessment", "DevSecOps", "cloud security", "digital transformation"].map(function (term) { return '"' + term + '"'; }),
    },
    delivery: {
      label: "Programme delivery & analytics",
      terms: ["programme management", "program management", "PMO", "technical assistance", "monitoring and evaluation", "learning analytics", "capacity building", "training consultancy"].map(function (term) { return '"' + term + '"'; }),
    },
    all: {
      label: "All prototype capability areas",
      terms: ["digital learning", "e-learning", "instructional design", "learning management system", "LMS migration", "cloud migration", "cybersecurity", "programme management", "training consultancy"].map(function (term) { return '"' + term + '"'; }),
    },
  };
  var sourceMarkets = {
    east: { label: "East Africa (Kenya, Uganda, Rwanda, Tanzania)", terms: '"Kenya" OR "Uganda" OR "Rwanda" OR "Tanzania"' },
    kenya: { label: "Kenya", terms: "Kenya" },
    uganda: { label: "Uganda", terms: "Uganda" },
    rwanda: { label: "Rwanda", terms: "Rwanda" },
    tanzania: { label: "Tanzania", terms: "Tanzania" },
    global: { label: "Global / international", terms: '"international tender" OR global OR international' },
    us: { label: "United States / international donors", terms: '"United States" OR global OR international' },
  };
  var tenderTerms = '(RFP OR tender OR procurement OR "request for proposal" OR EOI OR "request for quotation" OR consultancy)';
  var exclusions = '-"civil works" -"building works" -vehicles -catering -"office supplies" -"supply of tablets" -"supply of computers" -printing -internship -jobs';
  var sourceDirectory = [
    { tag: "FREE SEARCH", name: "Google Search", domain: "google.com", url: "https://www.google.com/", access: "Free", kind: "Search engine", relevance: "Best flexible discovery tool. Searches official procurement sites, PDFs, donor portals and cached notice pages.", caution: "Search results are not a validated tender feed; confirm current status on the buyer portal." },
    { tag: "FREE SEARCH", name: "Bing Search", domain: "bing.com", url: "https://www.bing.com/", access: "Free", kind: "Search engine", relevance: "A useful second index for procurement pages, framework notices and document attachments.", caution: "Search results may be stale or duplicated; verify each notice at source." },
    { tag: "AUTOMATED · FREE API", name: "TED public procurement notices", domain: "ted.europa.eu", url: "https://ted.europa.eu/en/", access: "Daily API scan enabled · no search key", kind: "Official procurement", relevance: "Published European public procurement notices are checked daily for learning, digital, cloud, cybersecurity and programme-delivery fit.", caution: "TED primarily covers European notices; confirm geographic eligibility and the buyer's original notice." },
    { tag: "AUTOMATED · FREE FEED", name: "UK Find a Tender", domain: "find-tender.service.gov.uk", url: "https://www.find-tender.service.gov.uk/Search", access: "Daily OCDS feed scan enabled · no search key", kind: "Official procurement", relevance: "UK public tender releases are checked against each workspace’s capabilities, keywords, sectors and target markets.", caution: "UK notices may be restricted to UK suppliers or require local delivery; verify eligibility before bidding." },
    { tag: "OFFICIAL · UN", name: "UN Global Marketplace (UNGM)", domain: "ungm.org", url: "https://www.ungm.org/Public/Notice", access: "Free search · vendor requirements vary", kind: "Official procurement", relevance: "UN agency RFPs, RFQs, EOIs, consultancy and partner calls. Filter by opportunity type and beneficiary country.", caution: "Register the legal entity and verify each agency's eligibility and vendor requirements." },
    { tag: "OFFICIAL · UN", name: "UNDP Procurement Notices", domain: "procurement-notices.undp.org", url: "https://procurement-notices.undp.org/", access: "Free", kind: "Official procurement", relevance: "Search active UNDP RFP/RFQ notices by country and document title; service and consulting categories often suit knowledge work.", caution: "Screen out goods, works and individual-contractor posts that do not fit a company bid." },
    { tag: "OFFICIAL · MDB", name: "World Bank Project Procurement", domain: "projects.worldbank.org", url: "https://projects.worldbank.org/en/projects-operations/procurement", access: "Free · email alerts", kind: "Official procurement", relevance: "Current opportunities and alerts for World Bank-financed borrower projects; filter for consulting, education, digital, ICT and training services.", caution: "Many notices are issued by borrower agencies; follow the linked country procurement documents." },
    { tag: "OFFICIAL · AFRICA", name: "African Development Bank procurement", domain: "afdb.org", url: "https://www.afdb.org/en/projects-and-operations/procurement", access: "Free", kind: "Official procurement", relevance: "AfDB-funded consulting and procurement notices across African member countries.", caution: "Check whether the bid is open to international firms, country-eligible suppliers or consortia." },
    { tag: "OFFICIAL · MDB", name: "Asian Development Bank business opportunities", domain: "adb.org", url: "https://www.adb.org/business/main", access: "Free", kind: "Official procurement", relevance: "International consulting and digital-development opportunities; useful as a selective global channel.", caution: "Lower geographic priority for East Africa; always confirm the project country and eligibility." },
    { tag: "OFFICIAL · UN", name: "UNOPS Business Opportunities", domain: "unops.org", url: "https://www.unops.org/business-opportunities", access: "Free", kind: "Official procurement", relevance: "UNOPS procurement and contracting opportunities, including services and project delivery.", caution: "UNOPS also procures construction and physical goods; qualify scope before investing." },
    { tag: "OFFICIAL · UN", name: "UNICEF Supply & Procurement", domain: "unicef.org/supply", url: "https://www.unicef.org/supply/procurement-services", access: "Free", kind: "Official procurement", relevance: "UNICEF supplier and procurement information. Use the site search to find current services, education, training and digital opportunities.", caution: "The linked procurement-services page is background information, not an RFP list; use the Google site-search link for notices." },
    { tag: "OFFICIAL · UN", name: "UNESCO Procurement", domain: "unesco.org", url: "https://www.unesco.org/en/procurement", access: "Free", kind: "Official procurement", relevance: "Education, learning, digital inclusion and consulting opportunities that may align with verified company capacity.", caution: "Verify current notice access and registration steps on UNESCO's official procurement pages." },
    { tag: "OFFICIAL · UN", name: "World Food Programme procurement", domain: "wfp.org/procurement", url: "https://www.wfp.org/procurement", access: "Free", kind: "Official procurement", relevance: "Buyer and supplier procurement information, including technical and professional services.", caution: "WFP is heavily goods/logistics focused; search for services and reject commodity/supply-only tenders." },
    { tag: "OFFICIAL · KENYA", name: "Kenya Public Procurement Information Portal", domain: "tenders.go.ke", url: "https://www.tenders.go.ke/", access: "Free", kind: "National portal", relevance: "Government opportunities for Kenyan-eligible suppliers; look for e-learning, training, ICT and consulting services.", caution: "Confirm registration, local preference, tax and ownership eligibility against the specific tender." },
    { tag: "OFFICIAL · UGANDA", name: "Uganda PPDA", domain: "ppda.go.ug", url: "https://www.ppda.go.ug/", access: "Free", kind: "National portal", relevance: "Official procurement framework, notices and guidance for Uganda; Mbale is in Uganda, so check the legal operating-market profile.", caution: "Follow links to the procuring entity/eGP portal and confirm current registration requirements." },
    { tag: "OFFICIAL · RWANDA", name: "Rwanda Umucyo e-Procurement", domain: "umucyo.gov.rw", url: "https://www.umucyo.gov.rw/", access: "Free", kind: "National portal", relevance: "Rwanda's online e-procurement system; useful for verified learning, ICT and consultancy fits.", caution: "Portal uses local processes; verify eligibility, language and supplier registration." },
    { tag: "OFFICIAL · TANZANIA", name: "Tanzania NeST e-Procurement", domain: "nest.go.tz", url: "https://nest.go.tz/", access: "Free", kind: "National portal", relevance: "Tanzania's NeST e-procurement entry point; search for services, education, training and ICT.", caution: "Verify the live portal address, current registration path, tender status and local participation rules before relying on a notice." },
    { tag: "OFFICIAL · EU", name: "EU Tenders Electronic Daily (TED)", domain: "ted.europa.eu", url: "https://ted.europa.eu/en/", access: "Free", kind: "Official procurement", relevance: "EU public notices and contract opportunities; search service contracts for e-learning, training, LMS and ICT.", caution: "Some lots have EU establishment, consortium, language or financial-capacity requirements." },
    { tag: "OFFICIAL · US", name: "SAM.gov Contract Opportunities", domain: "sam.gov", url: "https://sam.gov/opportunities", access: "Free", kind: "Official procurement", relevance: "US federal opportunities and prime/subcontracting signals; search training, digital learning, cloud and professional services.", caution: "A US search result is not proof a Kenya/Uganda company can prime. Check set-asides, entity registration, UEI, location and contract clauses." },
    { tag: "LOW-COST / FREEMIUM", name: "DevelopmentAid Tenders", domain: "developmentaid.org", url: "https://www.developmentaid.org/tenders", access: "Limited free access · paid tiers", kind: "Aggregator", relevance: "Development-sector procurement and donor notices across countries; filter by education, ICT, training and consulting.", caution: "Check current free-tier limits, notice freshness and buyer-source link before paying or bidding." },
    { tag: "LOW-COST / FREEMIUM", name: "Devex Funding & Tenders", domain: "devex.com", url: "https://www.devex.com/", access: "Limited free content · paid products", kind: "Aggregator", relevance: "Development finance, donor-funded project intelligence and selected procurement leads.", caution: "The product mixes funding intelligence with jobs and other content; confirm this is a company procurement contract." },
    { tag: "LOW-COST / MIXED", name: "dgMarket", domain: "dgmarket.com", url: "https://www.dgmarket.com/", access: "Public listings · paid alert services may apply", kind: "Aggregator", relevance: "Multi-country procurement listings that can surface donor-funded consulting and ICT notices.", caution: "Coverage and alert tiers change; check duplication and confirm the issuing agency's original notice." },
    { tag: "LOW-COST / MIXED", name: "TendersKenya", domain: "tenderskenya.co.ke", url: "https://tenderskenya.co.ke/", access: "Public listings · verify source notice", kind: "Aggregator", relevance: "A Kenya tender index that may surface digital, training and consulting notices for follow-up.", caution: "Confirm the current notice on the issuing buyer's official portal; listings can be incomplete or stale." },
    { tag: "ADJACENT · NOT TENDERS", name: "UNjobs", domain: "unjobs.org", url: "https://unjobs.org/skills/e-learning", access: "Free jobs index", kind: "Employment listings", relevance: "Useful for spotting individual consultancy and expert-role trends or institutional roster calls.", caution: "Primarily a job/vacancy index, not an organizational RFP database. Individual job applications are not company bids." },
    { tag: "OFFICIAL · HUMANITARIAN", name: "ReliefWeb Tender / RFP / EOI listings", domain: "reliefweb.int", url: "https://reliefweb.int/jobs?list=Tender%2FRFPs%2FEOIs%20Jobs&advanced-search=%28TY52695%29", access: "Free · API app name approval required for direct API access", kind: "Official humanitarian notices", relevance: "Humanitarian tender, RFP and EOI listings; the daily discovery scan searches this source alongside other permitted domains.", caution: "Verify the original notice, deadline and organization eligibility before bid work." },
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function previewRequest(route, options) {
    options = options || {};
    var method = options.method || "GET";
    var id = String(options.id || "");
    var body = options.body || {};
    var item;
    if (route === "login") throw new Error("Sign-in is disabled in this browser-only preview.");
    if (route === "bootstrap") {
      return {
        ok: true, mode: "preview", user: state.user, csrf: "",
        profile: clone(state.profile),
        subscription: clone(state.subscription),
        opportunities: clone(state.opportunities),
        projects: clone(state.projects),
        proposals: clone(state.proposals),
        learnings: clone(state.learnings),
        activity: clone(state.activity),
        users: clone(state.users),
        latest_discovery: null,
      };
    }
    if (route === "export") {
      return {
        ok: true,
        format_version: 1,
        exported_at: new Date().toISOString(),
        workspace: "NEXA BidOps preview",
        data: {
          company_profile: clone(state.profile ? [state.profile] : []),
          opportunities: clone(state.opportunities),
          projects: clone(state.projects),
          milestones: clone(state.projects.flatMap(function (project) { return project.milestones || []; })),
          proposals: clone(state.proposals),
          team: clone(state.users),
          activity: clone(state.activity),
          discovery_runs: [],
        },
      };
    }
    if (route === "users" && method === "GET") return { ok: true, users: clone(state.users) };
    if (route === "users" && method === "POST") {
      if (!["manager", "writer"].includes(body.role) || (state.user.role !== "owner" && body.role !== "writer")) {
        throw new Error("Only the workspace owner can invite another manager.");
      }
      var member = {
        user_id: "preview-staff-" + Date.now(),
        email: body.email,
        display_name: body.display_name,
        role: body.role,
        active: true,
        created_at: new Date().toISOString(),
      };
      state.activity.unshift({ action: "invite", entity_type: "user", entity_id: member.user_id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, user: clone(member), message: "preview only. No invitation email was sent." };
    }
    if (route === "user" && method === "PATCH") {
      item = state.users.find(function (member) { return member.user_id === String(id); });
      if (!item || item.role === "owner") throw new Error("staff account not found or protected.");
      if (body.role) item.role = body.role;
      if (typeof body.active === "boolean") item.active = body.active;
      state.activity.unshift({ action: "update", entity_type: "user", entity_id: item.user_id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, user: clone(item) };
    }
    if (route === "logout") return { ok: true };
    if (route === "subscription" && method === "GET") return { ok: true, subscription: clone(state.subscription) };
    if (route === "subscription" && method === "PATCH") {
      state.subscription = Object.assign({}, state.subscription, { plan: body.plan });
      return { ok: true, subscription: clone(state.subscription) };
    }
    if (route === "profile" && method === "PUT") {
      if (!(body.capabilities || []).length || !(body.preferred_keywords || []).length ||
          (!(body.preferred_countries || []).length && !(body.preferred_sectors || []).length)) {
        throw new Error("Add at least one capability, search keyword, and target market or sector to finish your profile.");
      }
      state.profile = Object.assign({}, state.profile, clone(body));
      state.profile.onboarding_complete = true;
      state.opportunities.forEach(function (opportunity) {
        var match = profileMatch(opportunity, state.profile);
        opportunity.fit_score = match.score;
        opportunity.fit_json = match;
      });
      state.activity.unshift({ action: "update", entity_type: "company_profile", entity_id: 1, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, profile: clone(state.profile) };
    }
    if (route === "activity" && method === "POST") {
      var activity = {
        action: "timeline_event",
        entity_type: "timeline",
        entity_id: String(body.opportunity_id),
        user_id: state.user.id,
        display_name: state.user.display_name,
        created_at: new Date().toISOString(),
        detail_json: {
          event_type: body.event_type,
          summary: body.summary,
          contact: body.contact || "",
          details: body.details || "",
          opportunity_id: String(body.opportunity_id),
        },
      };
      state.activity.unshift(activity);
      return { ok: true, activity: clone(activity) };
    }
    if (route === "opportunities" && method === "POST") {
      item = Object.assign({
        id: demo.nextId++,
        stage: "Discovered",
        deadline: null,
        currency: "USD",
        value: 0,
        requirements: "",
        owner: "",
        notes: "",
        fit_score: 38,
        fit_json: { matched: ["Digital learning content"], review: [], basis: "Keyword screening only. Confirm mandatory eligibility and evidence manually." },
      }, clone(body));
      item.fit_json = profileMatch(item, state.profile);
      item.fit_score = item.fit_json.score;
      state.opportunities.unshift(item);
      state.activity.unshift({ action: "create", entity_type: "opportunity", entity_id: item.id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, opportunity: clone(item) };
    }
    if (route === "opportunity" && method === "PATCH") {
      item = opportunityById(id);
      if (!item) throw new Error("Opportunity not found.");
      var previousStage = item.stage;
      Object.assign(item, clone(body));
      state.activity.unshift({
        action: body.stage ? "stage_change" : "update",
        entity_type: "opportunity",
        entity_id: item.id,
        detail_json: body.stage ? { from: previousStage, to: item.stage } : {},
        display_name: state.user.display_name,
        created_at: new Date().toISOString(),
      });
      return { ok: true, opportunity: clone(item) };
    }
    if (route === "proposal" && method === "GET") {
      item = state.proposals.find(function (proposal) { return String(proposal.opportunity_id) === id; });
      return { ok: true, proposal: item ? clone(item) : null };
    }
    if (route === "proposal" && method === "POST") {
      item = opportunityById(id);
      if (!item) throw new Error("Opportunity not found.");
      var existing = state.proposals.find(function (proposal) { return String(proposal.opportunity_id) === id; });
      if (Array.isArray(body.sections)) {
        if (!existing) existing = { id: id, opportunity_id: id, status: "Draft", opportunity_title: item.title };
        existing.sections_json = clone(body.sections);
      } else if (!existing || !existing.sections_json) {
        existing = {
          id: id,
          opportunity_id: id,
          status: "Draft",
          opportunity_title: item.title,
          sections_json: [
            { title: "Executive summary", text: state.profile.legal_name + " responds to the opportunity: " + item.title + ". Confirm the buyer, scope, outcome, duration and team before use." },
            { title: "Understanding of the requirement", text: "scope captured by the bid team:\n" + (item.requirements || "[Paste and verify the actual buyer's terms of reference.]") + "\n\nMap every mandatory criterion to a named response and verified evidence." },
            { title: "Technical approach and delivery", text: "Discover user and buyer constraints; agree a measurable design; deliver work in reviewable increments; pilot and resolve launch blockers; report outcomes against buyer-approved measures.\n\nTailor these steps to the actual RFP." },
            { title: "Work plan and deliverables", text: "Discovery: [dates, inputs, outputs]\nDesign: [dates, review gate]\nDelivery and QA: [dates, acceptance criteria]\nPilot and launch: [dates, support model]\nEvaluation and handover: [dates, measures]\n\nAdd a costed, resourced schedule." },
            { title: "Team and governance", text: "Project manager: [verified name, availability]\nTechnical lead: [verified name and credentials]\nQuality lead: [verified name and responsibilities]\nClient governance: [decision makers, meeting cadence and escalation path]\n\nAttach approved CVs." },
            { title: "Quality, safeguarding and risk", text: "Document project-specific delivery, data, accessibility, safeguarding, security and continuity risks. Assign owners, mitigations and escalation triggers. Claim a control or certification only when verified evidence is available." },
            { title: "Relevant experience and evidence", text: "Capabilities supplied by the bid team:\n" + (state.profile.capabilities || []).map(function (value) { return "- " + value; }).join("\n") + "\n\nApproved case studies:\n" + ((state.profile.case_studies || []).map(function (value) { return "- " + value; }).join("\n") || "[Add client-approved outcomes and references.]") + "\n\nNo client results or credentials are verified." },
            { title: "Financial proposal and compliance", text: "Currency: " + item.currency + "\nNotice value: " + Number(item.value || 0).toFixed(2) + "\n\nCredentials listed by the bid team:\n" + ((state.profile.certifications || []).map(function (value) { return "- " + value; }).join("\n") || "[Add verified credentials if required.]") + "\n\nComplete buyer pricing forms, taxes, exclusions, validity and mandatory declarations." },
          ],
        };
      }
      if (!state.proposals.some(function (proposal) { return String(proposal.opportunity_id) === id; })) state.proposals.push(existing);
      else if (existing) {
        var index = state.proposals.findIndex(function (proposal) { return String(proposal.opportunity_id) === id; });
        state.proposals[index] = existing;
      }
      state.activity.unshift({ action: "edit", entity_type: "proposal", entity_id: id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, sections: clone(existing.sections_json) };
    }
    if (route === "proposal" && method === "PATCH") {
      item = state.proposals.find(function (proposal) { return String(proposal.opportunity_id) === id; });
      if (!item) throw new Error("Proposal draft not found.");
      item.status = body.status;
      return { ok: true, status: item.status };
    }
    if (route === "interview" && method === "POST") {
      item = opportunityById(id);
      if (!item) throw new Error("Opportunity not found.");
      var questions = [
        ["How does your solution directly address the buyer's most important outcomes?", "Lead with the buyer's stated outcome, map it to one deliverable, explain how success is measured, and cite only verified evidence."],
        ["What makes your proposed team qualified to deliver this scope?", "Name the proposed people, responsibilities and availability. Use a comparable, permissioned case study."],
        ["How will you manage delivery risk, quality and changes?", "Give a real risk, its owner, warning signal, mitigation and escalation route."],
        ["How will you demonstrate value for money and measurable impact?", "Tie cost assumptions to work packages and outcomes. Explain baseline, target, data source and reporting cadence."],
        ["What would you do if the buyer's requirements changed?", "Explain impact assessment, options, written approval and protection of critical milestones."],
        ["How will you deliver " + ((item.fit_json && item.fit_json.matched && item.fit_json.matched[0]) || "the proposed approach") + " in this context?", "Describe the method, a verified example, quality checks, local/user considerations and evidence you can show."],
        ["What do you need from the buyer in the first 30 days?", "State the decisions, access, subject-matter input, data and approvals needed, who supplies them and the risk of delay."],
      ].map(function (question) { return { question: question[0], framework: question[1] }; });
      var savedProposal = state.proposals.find(function (proposal) { return String(proposal.opportunity_id) === id; });
      if (savedProposal) savedProposal.interview_json = clone(questions);
      state.activity.unshift({ action: "prepare", entity_type: "interview", entity_id: id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, questions: questions };
    }
    if (route === "project" && method === "POST") {
      item = opportunityById(id);
      if (!item || item.stage !== "Won") throw new Error("Mark an opportunity Won after award confirmation before creating its launch plan.");
      var project = state.projects.find(function (value) { return String(value.opportunity_id) === id; });
      if (!project) {
        project = {
          id: id, opportunity_id: id, opportunity_title: item.title, funder: item.funder,
          currency: item.currency, value: item.value, status: "Mobilising",
          project_manager: body.project_manager || "", start_date: body.start_date || null,
          milestones: ["Kick-off and mobilisation", "Requirements and acceptance baseline", "Delivery plan and risk register", "Pilot / readiness review", "Launch and stakeholder handover", "30-day outcomes review"].map(function (title) {
            return { id: demo.nextMilestone++, title: title, status: "Not started", due_date: null };
          }),
        };
        state.projects.push(project);
      }
      state.activity.unshift({ action: "launch_plan", entity_type: "project", entity_id: project.id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, project_id: project.id };
    }
    if (route === "milestone" && method === "PATCH") {
      var milestone;
      state.projects.some(function (project) {
        milestone = project.milestones.find(function (value) { return String(value.id) === id; });
        return Boolean(milestone);
      });
      if (!milestone) throw new Error("Milestone not found.");
      milestone.status = body.status;
      state.activity.unshift({ action: "update", entity_type: "milestone", entity_id: id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true };
    }
    throw new Error("That action is not available in preview.");
  }

  function request(route, options) {
    options = options || {};
    if (previewMode) {
      try {
        return Promise.resolve(previewRequest(route, options));
      } catch (error) {
        return Promise.reject(error);
      }
    }
    var headers = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-Token"] = state.csrf;
    }
    var accessToken = window.sessionStorage.getItem("afc_access_token");
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    var url = API + "?route=" + encodeURIComponent(route) + (options.id ? "&id=" + encodeURIComponent(options.id) : "");
    var requestOptions = {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    };
    function parseResponse(response) {
      return response.json().catch(function () {
        throw new Error("The server returned an unreadable response.");
      }).then(function (data) {
        if (!response.ok || data.ok === false) {
          if (response.status === 401 && route !== "login") {
            signInRequired();
          }
          if (response.status === 402) openPlanScreen(data.error || "Choose a plan to restore workspace access.");
          throw new Error(data.error || "The request could not be completed.");
        }
        return data;
      });
    }
    function send(retry) {
      return fetch(url, requestOptions).then(function (response) {
        if (response.status !== 401 || retry || ["login", "refresh"].indexOf(route) !== -1) {
          return parseResponse(response);
        }
        var refreshToken = window.sessionStorage.getItem("afc_refresh_token");
        if (!refreshToken) return parseResponse(response);
        return fetch(API + "?route=refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }).then(parseResponse).then(function (session) {
          window.sessionStorage.setItem("afc_access_token", session.access_token);
          window.sessionStorage.setItem("afc_refresh_token", session.refresh_token);
          requestOptions.headers.Authorization = "Bearer " + session.access_token;
          return send(true);
        }).catch(function (error) {
          window.sessionStorage.removeItem("afc_access_token");
          window.sessionStorage.removeItem("afc_refresh_token");
          signInRequired();
          throw error;
        });
      });
    }
    return send(false);
  }

  var noticeTimer;
  function notify(message, error) {
    var el = document.getElementById("notice");
    el.textContent = message;
    el.className = "notice show" + (error ? " error" : "");
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(function () { el.className = "notice"; }, 3300);
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = label || "Working…";
    } else {
      button.disabled = false;
      if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    }
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(Number(amount || 0));
    } catch (error) {
      return (currency || "USD") + " " + Math.round(Number(amount || 0)).toLocaleString("en-US");
    }
  }

  function totalsByCurrency(items) {
    var totals = {};
    items.forEach(function (item) {
      var currency = item.currency || "USD";
      totals[currency] = (totals[currency] || 0) + Number(item.value || 0);
    });
    var currencies = Object.keys(totals).sort();
    return currencies.length ? currencies.map(function (currency) {
      return money(totals[currency], currency);
    }).join(" · ") : money(0, "USD");
  }

  function dateLabel(value) {
    if (!value) return "Not set";
    var date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) return "Not set";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function daysLeft(value) {
    if (!value) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((new Date(value + "T00:00:00") - today) / 86400000);
  }

  function stageLabel(key) {
    var found = stageList.find(function (item) { return item[0] === key; });
    return found ? found[1] : key;
  }

  function stagePill(stage) {
    var cls = stage === "Won" ? "teal" : stage === "Lost" || stage === "NoGo" ? "red" :
      stage === "GoNoGo" || stage === "Review" ? "amber" : stage === "Submitted" ? "blue" : "";
    return '<span class="pill ' + cls + '">' + escapeHtml(stageLabel(stage)) + "</span>";
  }

  function fitMarkup(score) {
    var value = Math.max(0, Math.min(100, Number(score || 0)));
    return '<span class="fit-line">Profile match <span class="fit-bar"><i style="width:' + value + '%"></i></span><b>' + value + "%</b></span>";
  }

  function profileMatch(opportunity, profile) {
    var searchable = [
      opportunity.title, opportunity.requirements, opportunity.sector,
      opportunity.country, opportunity.funder_type, opportunity.funder,
    ].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    var stopWords = ["with", "from", "into", "that", "this", "your", "their", "about", "service", "services", "solution", "solutions", "support", "system", "systems"];
    function matches(item) {
      var phrase = String(item || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!phrase) return false;
      if ((" " + searchable + " ").indexOf(" " + phrase + " ") !== -1) return true;
      var words = phrase.split(" ").filter(function (word) { return word.length > 3 && stopWords.indexOf(word) === -1; });
      if (!words.length) return false;
      var hits = words.filter(function (word) { return searchable.indexOf(word) !== -1; }).length;
      return hits >= Math.max(1, Math.ceil(words.length * 0.6));
    }
    var dimensions = [];
    var matched = [];
    var missing = [];
    function add(label, items, weight) {
      var values = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!values.length) return;
      var hits = values.filter(matches);
      dimensions.push({ label: label, matched: hits.length, total: values.length, weight: weight, score: Math.round(hits.length / values.length * 100) });
      matched = matched.concat(hits.map(function (item) { return label + ": " + item; }));
      missing = missing.concat(values.filter(function (item) { return hits.indexOf(item) === -1; }).map(function (item) { return label + ": " + item; }));
    }
    add("Capability", profile.capabilities, 45);
    add("Search term", profile.preferred_keywords, 20);
    add("Sector", profile.preferred_sectors, 15);
    add("Target market", profile.preferred_countries, 10);
    add("Buyer type", profile.preferred_buyer_types, 10);
    var weight = dimensions.reduce(function (total, item) { return total + item.weight; }, 0);
    var score = weight ? Math.round(dimensions.reduce(function (total, item) { return total + item.score * item.weight; }, 0) / weight) : 0;
    var review = missing.length ? ["Profile criteria not found in the captured notice: " + missing.slice(0, 5).join(", ") + "."] : [];
    review.push("This profile-alignment score is not a supplier eligibility, compliance, or award prediction.");
    return {
      score: score,
      matched: matched,
      missing: missing,
      dimensions: dimensions,
      review: review,
      basis: "Weighted keyword alignment to this organization profile. Verify the complete notice and mandatory eligibility manually.",
    };
  }

  function opportunityById(id) {
    return state.opportunities.find(function (item) { return String(item.id) === String(id); });
  }

  function filteredOpportunities() {
    var query = state.search.trim().toLowerCase();
    return state.opportunities.filter(function (item) {
      var matchesQuery = !query || [
        item.title, item.funder, item.sector, item.country, item.requirements,
      ].join(" ").toLowerCase().indexOf(query) !== -1;
      return matchesQuery && (!state.stage || item.stage === state.stage) &&
        (!state.sector || item.sector === state.sector);
    });
  }

  function stats() {
    var openStages = ["Discovered", "GoNoGo", "Drafting", "Review"];
    var open = state.opportunities.filter(function (item) { return openStages.indexOf(item.stage) !== -1; });
    var decided = state.opportunities.filter(function (item) { return item.stage === "Won" || item.stage === "Lost"; });
    var won = state.opportunities.filter(function (item) { return item.stage === "Won"; });
    var due = open.filter(function (item) { var d = daysLeft(item.deadline); return d !== null && d >= 0 && d <= 7; });
    return {
      open: open,
      due: due,
      won: won,
      decided: decided,
      value: totalsByCurrency(open),
      wonValue: totalsByCurrency(won),
      winRate: decided.length ? Math.round(won.length / decided.length * 100) : null,
    };
  }

  function emptyState(title, message, action) {
    return '<div class="empty-state"><div class="empty-symbol">✦</div><b>' + escapeHtml(title) + "</b><p>" +
      escapeHtml(message) + "</p>" + (action || "") + "</div>";
  }

  function pageHead(label, title, subtitle, action) {
    return '<div class="page-head"><div><span class="eyebrow">' + escapeHtml(label) + "</span><h1>" +
      escapeHtml(title) + "</h1><p>" + escapeHtml(subtitle) + "</p></div><div class=\"page-actions\">" +
      (action || "") + "</div></div>";
  }

  function openOpportunityButton(id) {
    return '<button class="row-action" data-open-opportunity="' + escapeHtml(id) + '">Open →</button>';
  }

  function activityTitle(item) {
    var detail = item.detail_json || {};
    var eventTitles = {
      email_sent: "Email sent",
      email_response_received: "Response received via email",
      vendor_update_sent: "Email update sent to vendor",
      confirmation_received: "Confirmation received",
      project_started: "Project started",
      project_update_sent: "Project update sent",
      meeting_held: "Meeting completed",
      other_note: "Activity note",
    };
    if (item.action === "timeline_event") return eventTitles[detail.event_type] || "Activity recorded";
    if (item.action === "auto_discover") return "Opportunity found";
    if (item.action === "create" && item.entity_type === "opportunity") return "Opportunity found";
    if (["generate", "edit"].includes(item.action) && item.entity_type === "proposal") {
      return item.action === "generate" ? "Bid created" : "Bid updated";
    }
    if (item.action === "stage_change") return "Bid stage updated · " + stageLabel(detail.to || "");
    if (item.action === "launch_plan") return "Project launch plan created";
    if (item.action === "update" && item.entity_type === "milestone") return "Project milestone updated";
    if (item.action === "invite") return "Team member invited";
    if (item.entity_type === "organization_profile") return "Company profile updated";
    if (item.action === "update" && item.entity_type === "opportunity") return "Opportunity updated";
    return "";
  }

  function activityTimeline(limit) {
    var timeline = (state.activity || []).map(function (item) {
      var detail = item.detail_json || {};
      var title = activityTitle(item);
      var opportunityId = detail.opportunity_id || (["opportunity", "proposal", "interview", "timeline"].includes(item.entity_type) ? item.entity_id : "");
      var opportunity = opportunityById(opportunityId);
      return { item: item, detail: detail, title: title, opportunity: opportunity };
    }).filter(function (entry) { return entry.title; })
      .sort(function (a, b) { return String(b.item.created_at || "").localeCompare(String(a.item.created_at || "")); })
      .slice(0, limit);
    if (!timeline.length) {
      return emptyState("Your timeline starts with the first move", "Opportunity discoveries, bid decisions, drafts, communication logs and delivery milestones will appear here.");
    }
    return '<div class="activity-timeline">' + timeline.map(function (entry) {
      var item = entry.item;
      var detail = entry.detail;
      var date = new Date(item.created_at || "");
      var timestamp = Number.isNaN(date.getTime()) ? "Time not recorded" :
        date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      var description = detail.summary || detail.fit_reason || detail.to && ("Moved from " + stageLabel(detail.from || "") + " to " + stageLabel(detail.to)) ||
        (entry.opportunity ? entry.opportunity.funder : "Workspace activity");
      var extra = [detail.contact, detail.details].filter(Boolean).join(" · ");
      var icon = item.action === "timeline_event" ? "↗" :
        item.entity_type === "opportunity" ? "⌕" : item.entity_type === "proposal" ? "✳" :
          item.entity_type === "project" || item.entity_type === "milestone" ? "▣" : "•";
      return '<article class="timeline-entry"><span class="timeline-marker">' + icon + '</span><div class="timeline-main"><div class="timeline-topline"><b>' +
        escapeHtml(entry.title) + '</b><time>' + escapeHtml(timestamp) + '</time></div><p>' + escapeHtml(description) + '</p>' +
        (extra ? '<small>' + escapeHtml(extra) + '</small>' : "") +
        (entry.opportunity ? '<button class="row-action timeline-open" data-open-opportunity="' + escapeHtml(entry.opportunity.id) + '">' +
          escapeHtml(entry.opportunity.title) + ' ↗</button>' : "") +
        '<small class="timeline-actor">' + escapeHtml(item.display_name || "Workspace user") + "</small></div></article>";
    }).join("") + "</div>";
  }

  function activityForm() {
    if (!state.opportunities.length) {
      notify("Capture an opportunity before logging activity.", true);
      return;
    }
    showModal('<span class="eyebrow">KEEP THE STORY CURRENT</span><h2 id="modalTitle">Log timeline activity</h2><p class="modal-intro">Record a real communication or project milestone against an opportunity.</p>' +
      '<div class="callout"><strong>Manual activity log.</strong> This records what your team says happened. It does not send emails, read inboxes, or verify a reply.</div>' +
      '<form id="activityForm"><div class="form-two"><div class="form-field"><label for="activityType">EVENT *</label><select id="activityType" name="event_type" class="select" required>' +
      '<option value="email_sent">Email sent</option><option value="email_response_received">Response received via email</option><option value="vendor_update_sent">Email update sent to vendor</option><option value="confirmation_received">Confirmation received</option><option value="project_started">Project started</option><option value="project_update_sent">Project update sent</option><option value="meeting_held">Meeting completed</option><option value="other_note">Activity note</option></select></div>' +
      '<div class="form-field"><label for="activityOpportunity">RELATED OPPORTUNITY *</label><select id="activityOpportunity" name="opportunity_id" class="select" required><option value="">Select an opportunity</option>' +
      state.opportunities.map(function (item) { return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.title) + "</option>"; }).join("") +
      '</select></div></div><div class="form-field"><label for="activitySummary">WHAT HAPPENED? *</label><input id="activitySummary" name="summary" class="field" maxlength="240" required placeholder="e.g. Buyer confirmed receipt of the proposal"></div>' +
      '<div class="form-field"><label for="activityContact">CONTACT / ORGANIZATION</label><input id="activityContact" name="contact" class="field" maxlength="190" placeholder="Buyer contact or vendor"></div>' +
      '<div class="form-field"><label for="activityDetails">NOTES</label><textarea id="activityDetails" name="details" class="textarea" maxlength="2000" placeholder="Next action, owner or confirmation reference"></textarea></div>' +
      '<div id="activityFormError" class="form-error" role="alert"></div><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add to timeline →</button></div></form>');
  }

  function supportForm() {
    showModal('<span class="eyebrow">NEXA CUSTOMER CARE</span><h2 id="modalTitle">Contact support</h2><p class="modal-intro">Tell us what happened. Urgent requests are sent to the NEXA support inbox.</p>' +
      '<form id="supportForm"><div class="form-two"><div class="form-field"><label for="supportName">YOUR NAME *</label><input id="supportName" class="field" name="name" required maxlength="120" autocomplete="name" value="' +
      escapeHtml(state.user && state.user.display_name || "") + '"></div><div class="form-field"><label for="supportEmail">EMAIL *</label><input id="supportEmail" class="field" type="email" name="email" required maxlength="254" autocomplete="email" value="' +
      escapeHtml(state.user && state.user.username || "") + '"></div></div><div class="form-field"><label for="supportPhone">PHONE (OPTIONAL)</label><input id="supportPhone" class="field" name="phone" maxlength="32" autocomplete="tel"></div>' +
      '<div class="form-field"><label for="supportSubject">SUBJECT *</label><input id="supportSubject" class="field" name="subject" required maxlength="160" placeholder="How can we help?"></div>' +
      '<div class="form-field"><label for="supportMessage">MESSAGE *</label><textarea id="supportMessage" class="textarea" name="message" required maxlength="4000" placeholder="Include what you were trying to do and any error message."></textarea></div>' +
      '<label class="consent-option"><input name="marketing_consent" type="checkbox" value="true"> I would also like occasional product and service updates. Optional.</label>' +
      '<div id="supportError" class="form-error" role="alert"></div><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Send to NEXA support →</button></div></form>');
  }

  function renderDashboard() {
    var s = stats();
    var decisions = state.opportunities.filter(function (item) { return item.stage === "GoNoGo"; });
    var near = s.open.slice().sort(function (a, b) {
      var da = daysLeft(a.deadline);
      var db = daysLeft(b.deadline);
      return (da === null ? 99999 : da) - (db === null ? 99999 : db);
    }).slice(0, 5);
    var stages = stageList.filter(function (stage) {
      return state.opportunities.some(function (item) { return item.stage === stage[0]; });
    });
    var maxStage = Math.max(1, ...stages.map(function (stage) {
      return state.opportunities.filter(function (item) { return item.stage === stage[0]; }).length;
    }));
    var stageContent = stages.length ? stages.map(function (stage, index) {
      var count = state.opportunities.filter(function (item) { return item.stage === stage[0]; }).length;
      return '<div class="stage-row"><span>' + escapeHtml(stage[1]) + '</span><span class="stage-track"><i style="width:' +
        Math.round(count / maxStage * 100) + "%;background:" + ["#5271ec", "#dc963a", "#9d78ec", "#1ab99a", "#8592a7", "#20a37f", "#d4636c", "#a9b0bd"][index] +
        '"></i></span><span class="stage-count">' + count + "</span></div>";
    }).join("") : emptyState("Your pipeline starts here", "Capture your first real tender to see stage movement and value.");
    var decisionContent = decisions.length ? decisions.map(function (item) {
      return '<div class="opp-row"><div><div class="opp-name">' + escapeHtml(item.title) + '</div><div class="opp-meta">' +
        escapeHtml(item.funder) + " · " + dateLabel(item.deadline) + "</div>" + fitMarkup(item.fit_score) +
        '</div><div class="opp-right">' + money(item.value, item.currency) + "<br>" +
        openOpportunityButton(item.id) + "</div></div>";
    }).join("") : emptyState("No decision queue", "Move a captured tender to Decision when it is ready for an evidence-based go / no-go call.", '<button class="button button-small" data-nav="opportunities">Review opportunities</button>');
    var dueContent = near.length ? near.map(function (item) {
      var days = daysLeft(item.deadline);
      var label = days === null ? "Deadline to confirm" : days < 0 ? "Deadline passed" : days === 0 ? "Due today" : days + " days left";
      var color = days !== null && days <= 3 ? "red" : days !== null && days <= 10 ? "amber" : "";
      return '<div class="opp-row"><div><div class="opp-name">' + escapeHtml(item.title) + '</div><div class="opp-meta">' +
        escapeHtml(item.funder) + " · " + escapeHtml(stageLabel(item.stage)) + "</div></div><div class=\"opp-right\"><span class=\"pill " +
        color + '">' + escapeHtml(label) + "</span><br>" + openOpportunityButton(item.id) + "</div></div>";
    }).join("") : emptyState("Nothing on the radar yet", "Capture an opportunity to start tracking deadlines, fit and the next decision.", '<button class="button button-primary button-small" data-action="new-opportunity">＋ Capture a tender</button>');
    var freshSignals = state.opportunities.filter(function (item) {
      return item.source_url && item.discovered_at;
    }).sort(function (a, b) {
      return String(b.discovered_at).localeCompare(String(a.discovered_at));
    }).slice(0, 5);
    var signalContent = freshSignals.length ? freshSignals.map(function (item) {
      return '<div class="opp-row"><div><div class="opp-name">' + escapeHtml(item.title) +
        '</div><div class="opp-meta">' + escapeHtml(item.source_name || item.funder) + ' · Discovered ' +
        escapeHtml(new Date(item.discovered_at).toLocaleDateString()) + '</div>' + fitMarkup(item.fit_score) +
        '</div><div class="opp-right"><a href="' + escapeHtml(item.source_url) +
        '" target="_blank" rel="noopener noreferrer">Verify notice ↗</a><br>' + openOpportunityButton(item.id) + '</div></div>';
    }).join("") : emptyState("No automated signals yet", previewMode
      ? "The interactive preview does not run live source searches."
      : state.latestDiscovery && state.latestDiscovery.status === "completed"
        ? "The latest public-source scan found no matching new notices."
        : "Daily public-source opportunities will appear here after the scheduled scan completes.", '<button class="button button-small" data-nav="opportunities">Review sources</button>');
    var discoveryStatus = state.latestDiscovery
      ? "Last scan " + new Date(state.latestDiscovery.started_at).toLocaleString() + " · " +
        (state.latestDiscovery.status === "completed" ? Number(state.latestDiscovery.added_count || 0) + " added" : state.latestDiscovery.status) +
        (state.latestDiscovery.error_message ? " · source warning" : "")
      : "Daily public-source scan not run yet";
    var topAction = state.user && (state.user.role === "owner" || state.user.role === "manager")
      ? '<button class="button" data-action="log-activity">＋ Log activity</button><button class="button button-primary" data-action="new-opportunity">＋ Capture opportunity</button>' : "";
    var reminder = "";
    if (state.subscription && state.subscription.status === "trialing" && state.subscription.trial_ends_at) {
      var daysRemaining = Math.ceil((Date.parse(state.subscription.trial_ends_at) - Date.now()) / 86400000);
      if (daysRemaining <= 3) {
        reminder = '<div class="billing-reminder"><div><b>' +
          (daysRemaining <= 0 ? "Your free trial has ended." : "Your free trial ends in " + daysRemaining + (daysRemaining === 1 ? " day." : " days.")) +
          '</b><span>Choose a plan to keep your opportunities, proposals and project history available.</span></div><button class="button button-primary" data-action="manage-plan">Review plans →</button></div>';
      }
    } else if (state.subscription && state.subscription.status === "active" && state.subscription.current_period_end) {
      var billingDaysRemaining = Math.ceil((Date.parse(state.subscription.current_period_end) - Date.now()) / 86400000);
      if (billingDaysRemaining <= 3 && billingDaysRemaining >= 0 && state.subscription.provider === "mpesa") {
        reminder = '<div class="billing-reminder"><div><b>Your M-Pesa subscription period ends in ' +
          billingDaysRemaining + (billingDaysRemaining === 1 ? " day." : " days.") +
          '</b><span>Renew from Manage plan to keep this workspace active. M-Pesa renewals are not automatic.</span></div><button class="button button-primary" data-action="manage-plan">Renew plan →</button></div>';
      }
    }

    document.getElementById("view-dashboard").innerHTML =
      pageHead("CEO / PROJECT MANAGER · COMMAND VIEW", "A clearer path from signal to impact.", "Your bid portfolio, the next decision and launch readiness — in one private workspace.", topAction) +
      reminder +
      '<div class="stat-grid">' +
      '<article class="stat-card"><div class="stat-top"><span>OPEN OPPORTUNITIES</span><span class="stat-icon">⌕</span></div><div class="stat-value">' + s.open.length +
      '</div><div class="stat-foot">Live records in the decision funnel</div></article>' +
      '<article class="stat-card amber"><div class="stat-top"><span>DEADLINES · 7 DAYS</span><span class="stat-icon">◷</span></div><div class="stat-value">' + s.due.length +
      '</div><div class="stat-foot">Open bids approaching submission</div></article>' +
      '<article class="stat-card blue"><div class="stat-top"><span>OPEN PIPELINE VALUE</span><span class="stat-icon">↗</span></div><div class="stat-value" style="font-size:18px">' +
      escapeHtml(s.value) + '</div><div class="stat-foot">Indicative values by currency — not weighted or forecast</div></article>' +
      '<article class="stat-card dark"><div class="stat-top"><span>WIN RATE · DECIDED BIDS</span><span class="stat-icon">✳</span></div><div class="stat-value">' +
      (s.winRate === null ? "—" : s.winRate + "%") + '</div><div class="stat-foot">' + s.won.length + " won · " +
      state.opportunities.filter(function (item) { return item.stage === "Lost"; }).length + " lost · " + (s.winRate === null ? "awaiting outcomes" : "historical only") + "</div></article></div>" +
      '<article class="panel"><div class="panel-head"><div><h2 class="panel-title">Fresh opportunity signals</h2><p class="panel-sub">' +
      escapeHtml(discoveryStatus) + '</p></div><button class="text-link" data-nav="opportunities">All sources →</button></div><div class="panel-body"><div class="opportunity-list">' +
      signalContent + '</div><p class="panel-sub">Keyword-screened public notices are not verified eligibility decisions. Check the original notice before committing bid effort.</p></div></article>' +
      '<article class="panel activity-panel"><div class="panel-head"><div><h2 class="panel-title">The work in motion</h2><p class="panel-sub">A live story of discoveries, decisions, communication and delivery.</p></div><button class="text-link" data-nav="reports">Full portfolio timeline →</button></div><div class="panel-body">' +
      activityTimeline(8) + '</div></article>' +
      '<div class="dashboard-grid"><div class="column-stack">' +
      '<article class="panel"><div class="panel-head"><div><h2 class="panel-title">Decision room</h2><p class="panel-sub">The bids that need a clear Go / No-Go call</p></div><button class="text-link" data-nav="opportunities">View radar →</button></div><div class="opportunity-list">' +
      decisionContent + '</div></article>' +
      '<article class="panel"><div class="panel-head"><div><h2 class="panel-title">Deadline watch</h2><p class="panel-sub">Upcoming open opportunities, ordered by deadline</p></div><button class="text-link" data-nav="pipeline">Full pipeline →</button></div><div class="opportunity-list">' +
      dueContent + '</div></article></div>' +
      '<div class="column-stack"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Pipeline health</h2><p class="panel-sub">A portfolio view, not a revenue forecast</p></div></div><div class="panel-body"><div class="stage-rows">' +
      stageContent + '</div></div></article>' +
      '<article class="panel"><div class="panel-head"><div><h2 class="panel-title">Winning rhythm</h2><p class="panel-sub">Four controls that improve bid quality</p></div></div><div class="panel-body">' +
      '<div class="signal-card"><span class="signal-label"><i></i> 01 · SELECT</span><h3>Prove the fit before investing in a bid.</h3><p>Match scope to real capabilities, eligibility and evidence.</p></div>' +
      '<div class="signal-card"><span class="signal-label"><i></i> 02 · EVIDENCE</span><h3>Every claim has an owner and a source.</h3><p>Replace placeholders with verified references, CVs and credentials.</p></div>' +
      '<div class="signal-card"><span class="signal-label"><i></i> 03 · DELIVER</span><h3>Turn the award into a confident launch.</h3><p>Kick-off, acceptance gates, risk ownership and early outcomes.</p></div></div></article></div></div>';
  }

  function sourceSearchUrl(source, engine) {
    var group = sourceKeywordGroups[state.sourceCapability] || sourceKeywordGroups.learning;
    var market = sourceMarkets[state.sourceMarket] || sourceMarkets.east;
    var profileTerms = (state.profile && state.profile.preferred_keywords || [])
      .concat(state.profile && state.profile.capabilities || [])
      .concat(state.profile && state.profile.preferred_sectors || [])
      .filter(Boolean).slice(0, 8).map(function (term) { return '"' + String(term).replace(/"/g, "") + '"'; });
    var terms = "(" + Array.from(new Set(profileTerms.concat(group.terms))).join(" OR ") + ")";
    var profileMarkets = (state.profile && state.profile.preferred_countries || []).filter(Boolean)
      .slice(0, 8).map(function (country) { return '"' + String(country).replace(/"/g, "") + '"'; });
    var marketTerms = profileMarkets.length ? "(" + profileMarkets.join(" OR ") + " OR " + market.terms + ")" : market.terms;
    var adjacent = source.kind === "Employment listings" || source.kind === "Context / jobs";
    var query = (engine || source.domain === "google.com" || source.domain === "bing.com" ? "" : "site:" + source.domain + " ") +
      terms + " " + marketTerms + (adjacent ? "" : " " + tenderTerms + " " + exclusions);
    var base = engine === "bing" || source.domain === "bing.com" ? "https://www.bing.com/search?q=" : "https://www.google.com/search?q=";
    return base + encodeURIComponent(query);
  }

  function sourceCards() {
    var group = sourceKeywordGroups[state.sourceCapability] || sourceKeywordGroups.learning;
    var market = sourceMarkets[state.sourceMarket] || sourceMarkets.east;
    var profileTerms = (state.profile && state.profile.preferred_keywords || [])
      .concat(state.profile && state.profile.capabilities || [])
      .concat(state.profile && state.profile.preferred_sectors || [])
      .filter(Boolean).slice(0, 8).map(function (term) { return '"' + String(term).replace(/"/g, "") + '"'; });
    var displayedTerms = Array.from(new Set(profileTerms.concat(group.terms)));
    var cards = sourceDirectory.map(function (source) {
      var queryUrl = sourceSearchUrl(source);
      var directLink = source.kind === "Search engine" ? queryUrl : source.url;
      var directLabel = source.kind === "Search engine" ? "Search this web ↗" : "Open official site ↗";
      return '<article class="source-card"><span class="source-tag">' + escapeHtml(source.tag) + '</span><b>' + escapeHtml(source.name) +
        '</b><span class="source-access">' + escapeHtml(source.access) + '</span><p>' + escapeHtml(source.relevance) +
        '</p><p class="source-caution">' + escapeHtml(source.caution) + '</p><div class="source-links"><a href="' + escapeHtml(directLink) +
        '" target="_blank" rel="noopener noreferrer">' + directLabel + '</a>' +
        (source.kind === "Search engine" ? "" : '<a href="' + escapeHtml(queryUrl) + '" target="_blank" rel="noopener noreferrer">Search matching notices ↗</a>') +
        "</div></article>";
    }).join("");
    return '<div class="source-controls"><label>CAPABILITY CLUSTER<select id="sourceCapability" class="select">' +
      Object.keys(sourceKeywordGroups).map(function (key) {
        return '<option value="' + key + '"' + (state.sourceCapability === key ? " selected" : "") + ">" + escapeHtml(sourceKeywordGroups[key].label) + "</option>";
      }).join("") + '</select></label><label>MARKET FOCUS<select id="sourceMarket" class="select">' +
      Object.keys(sourceMarkets).map(function (key) {
        return '<option value="' + key + '"' + (state.sourceMarket === key ? " selected" : "") + ">" + escapeHtml(sourceMarkets[key].label) + "</option>";
      }).join("") + '</select></label><a class="button button-small" href="' + escapeHtml(sourceSearchUrl({ domain: "google.com", kind: "Search engine" }, "google")) +
      '" target="_blank" rel="noopener noreferrer">Run Google search ↗</a></div>' +
      '<div class="keyword-list"><b>KEYWORDS INCLUDED</b>' + displayedTerms.map(function (term) {
        return '<span class="keyword-chip">' + escapeHtml(term) + "</span>";
      }).join("") + '</div><div class="callout source-query"><strong>Search recipe:</strong> ' + escapeHtml(group.label) + " + " + escapeHtml(market.label) +
      ' + RFP / tender / procurement / EOI / consultancy. Poor-fit exclusions: civil/building works, vehicles, catering, office supplies, computer/tablet-only supply and printing. <b>Searches include this organization’s saved capabilities, keywords, and target markets. The scheduled scan checks TED and UK Find a Tender and saves profile matches; it does not crawl all of Google. Verify every notice and eligibility requirement.</b></div>' +
      '<div class="source-grid">' + cards + "</div>" +
      '<p class="source-footnote">Source coverage and free/paid access can change. Direct links are starting points, not endorsements. Always check the buyer’s original notice, deadline, legal-entity eligibility, registration and all mandatory criteria. UNjobs is mainly a jobs index; only institutional consultancy rosters suitable for company participation belong in the bid pipeline.</p>';
  }

  function renderOpportunities() {
    var records = filteredOpportunities();
    var sectors = Array.from(new Set(state.opportunities.map(function (item) { return item.sector; }).filter(Boolean))).sort();
    var rows = records.length ? records.map(function (item) {
      var days = daysLeft(item.deadline);
      var deadlineTone = days !== null && days < 0 ? "red" : days !== null && days <= 5 ? "amber" : "";
      return "<tr><td><b>" + escapeHtml(item.title) + '</b><div class="opp-meta">' + escapeHtml(item.funder) + "</div></td><td>" +
        escapeHtml(item.sector || "—") + (item.source_url ? '<div class="opp-meta"><a href="' + escapeHtml(item.source_url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(item.source_name || "Source notice") + " ↗</a></div>" : "") + "</td><td>" + (item.deadline ? '<span class="pill ' + deadlineTone + '">' + dateLabel(item.deadline) + "</span>" : "—") +
        "</td><td>" + money(item.value, item.currency) + "</td><td>" + fitMarkup(item.fit_score) + "</td><td>" + stagePill(item.stage) +
        "</td><td>" + openOpportunityButton(item.id) + "</td></tr>";
    }).join("") : '<tr><td colspan="7">' + emptyState(state.opportunities.length ? "No matching opportunities" : "Start with a verified signal", state.opportunities.length ?
      "Try a different search or filter." : "Capture a tender from an official buyer or funder source. Add the exact scope, deadline and evidence requirements so your team can assess it.", state.opportunities.length ? "" : '<button class="button button-primary button-small" data-action="new-opportunity">＋ Capture first opportunity</button>') + "</td></tr>";

    document.getElementById("view-opportunities").innerHTML =
      pageHead("FIND · QUALIFY · DECIDE", "Opportunity radar", "Capture real notices, screen capability fit and make an accountable go / no-go decision.",
        state.user && (state.user.role === "owner" || state.user.role === "manager") ? '<button class="button button-primary" data-action="new-opportunity">＋ Capture opportunity</button>' : "") +
      '<div class="callout"><strong>Daily free-source discovery is on.</strong> The scheduled scan checks TED and UK Find a Tender, then saves capability-keyword matches here. Results are not eligibility decisions, coverage is not comprehensive, and some notices may exclude East African suppliers. Verify every notice and mandatory criterion with the buyer.</div>' +
      '<article class="panel"><div class="toolbar"><input id="oppSearch" class="field" placeholder="Search title, funder, requirements…" value="' + escapeHtml(state.search) +
      '"><select id="oppStage" class="select"><option value="">All stages</option>' + stageList.map(function (stage) {
        return '<option value="' + stage[0] + '"' + (state.stage === stage[0] ? " selected" : "") + ">" + escapeHtml(stage[1]) + "</option>";
      }).join("") + '</select><select id="oppSector" class="select"><option value="">All sectors</option>' + sectors.map(function (sector) {
        return '<option' + (state.sector === sector ? " selected" : "") + ">" + escapeHtml(sector) + "</option>";
      }).join("") + '</select><span class="pill">' + records.length + " records</span></div>" +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Opportunity / Buyer</th><th>Sector</th><th>Deadline</th><th>Value</th><th>Capability fit</th><th>Stage</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table></div></article><div style=\"height:24px\"></div>" +
      pageHead("TRUSTED ENTRY POINTS", "A smarter signal stack.", "Start at the official source; capture the notice and verify its current status before committing bid effort.") +
      sourceCards();
  }

  function renderPipeline() {
    var columns = stageList.map(function (stage) {
      var items = state.opportunities.filter(function (item) { return item.stage === stage[0]; });
      return '<div class="pipeline-col"><div class="pipeline-col-head">' + escapeHtml(stage[1]) + "<span>" + items.length + "</span></div>" +
        (items.length ? items.map(function (item) {
          return '<article class="pipeline-card" data-open-opportunity="' + escapeHtml(item.id) + '"><b>' + escapeHtml(item.title) +
            '</b><small>' + escapeHtml(item.funder) + "</small><small>" + money(item.value, item.currency) + " · " + dateLabel(item.deadline) +
            "</small>" + fitMarkup(item.fit_score) + "</article>";
        }).join("") : '<div class="empty-state" style="padding:18px 5px"><p>Nothing here yet</p></div>') + "</div>";
    }).join("");
    document.getElementById("view-pipeline").innerHTML =
      pageHead("PORTFOLIO · NEXT ACTION · VALUE", "Bid pipeline", "Keep each opportunity moving with clear ownership, deadlines and decision gates.",
        state.user && (state.user.role === "owner" || state.user.role === "manager") ? '<button class="button button-primary" data-action="new-opportunity">＋ Capture opportunity</button>' : "") +
      '<div class="callout"><strong>Value discipline.</strong> Bid value is the notice&#39;s indicative amount, not weighted pipeline, expected revenue or a commitment.</div>' +
      (state.opportunities.length ? '<div class="pipeline-board">' + columns + "</div>" : emptyState("A live pipeline starts with verified opportunities", "Add verified opportunities to build an accurate portfolio view.", '<button class="button button-primary" data-action="new-opportunity">＋ Capture opportunity</button>'));
  }

  function renderReports() {
    var s = stats();
    var won = state.opportunities.filter(function (item) { return item.stage === "Won"; });
    var lost = state.opportunities.filter(function (item) { return item.stage === "Lost"; });
    var rows = state.opportunities.length ? state.opportunities.slice().sort(function (a, b) {
      return String(a.deadline || "9999").localeCompare(String(b.deadline || "9999"));
    }).map(function (item) {
      return "<tr><td><b>" + escapeHtml(item.title) + '</b><div class="opp-meta">' + escapeHtml(item.funder) +
        "</div></td><td>" + escapeHtml(stageLabel(item.stage)) + "</td><td>" + dateLabel(item.deadline) + "</td><td>" +
        money(item.value, item.currency) + "</td><td>" + Number(item.fit_score || 0) + "</td></tr>";
    }).join("") : '<tr><td colspan="5">' + emptyState("No portfolio records yet", "Report data is calculated from your real opportunities only.") + "</td></tr>";
    document.getElementById("view-reports").innerHTML =
      pageHead("PORTFOLIO · EVIDENCE · MOMENTUM", "Portfolio report", "A clean management snapshot of real bid records and the latest team updates.",
        (state.user && ["owner", "manager", "writer"].includes(state.user.role) ? '<button class="button" data-action="log-activity">＋ Log activity</button>' : "") +
        '<button class="button" data-action="export-csv">↓ Export CSV</button>' +
        (state.user && ["owner", "manager"].includes(state.user.role) ? '<button class="button" data-action="export-backup">↓ Download workspace backup</button>' : "") +
        '<button class="button button-primary" data-action="print-report">Print report</button>') +
      '<div class="callout"><strong>Reporting note.</strong> Bid value is indicative and unweighted. Win rate uses only opportunities marked Won or Lost; it is descriptive, not a forward projection. Live changes are saved in the shared Supabase workspace. Owners and managers can download a JSON backup for their device.</div>' +
      '<div class="stat-grid"><article class="stat-card"><div class="stat-top"><span>OPEN BID VALUE</span><span class="stat-icon">↗</span></div><div class="stat-value" style="font-size:18px">' +
      escapeHtml(s.value) + '</div><div class="stat-foot">' + s.open.length + " active opportunities · by currency</div></article>" +
      '<article class="stat-card"><div class="stat-top"><span>VALUE AWARDED</span><span class="stat-icon">✳</span></div><div class="stat-value" style="font-size:18px">' +
      escapeHtml(s.wonValue) + '</div><div class="stat-foot">' + won.length + " marked Won · confirm award records</div></article>" +
      '<article class="stat-card blue"><div class="stat-top"><span>SUBMITTED · AWAITING RESULT</span><span class="stat-icon">▤</span></div><div class="stat-value">' +
      state.opportunities.filter(function (item) { return item.stage === "Submitted"; }).length + '</div><div class="stat-foot">Keep follow-up dates and clarifications current</div></article>' +
      '<article class="stat-card amber"><div class="stat-top"><span>DECIDED BID WIN RATE</span><span class="stat-icon">◷</span></div><div class="stat-value">' +
      (s.winRate === null ? "—" : s.winRate + "%") + '</div><div class="stat-foot">' + won.length + " won · " + lost.length + " lost</div></article></div>" +
      '<div class="dashboard-grid"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Portfolio register</h2><p class="panel-sub">All captured opportunities · ordered by deadline</p></div></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Opportunity / Buyer</th><th>Stage</th><th>Deadline</th><th>Value</th><th>Fit signal</th></tr></thead><tbody>' +
      rows + "</tbody></table></div></article><article class=\"panel\"><div class=\"panel-head\"><div><h2 class=\"panel-title\">Portfolio timeline</h2><p class=\"panel-sub\">Audited actions and manually recorded buyer communications</p></div></div>" +
      '<div class="panel-body">' + activityTimeline(50) + "</div></article></div>";
  }

  function renderProposal() {
    var choices = state.opportunities.filter(function (item) { return item.stage !== "Lost" && item.stage !== "NoGo"; });
    var active = state.activeProposal;
    var current = active ? opportunityById(active) : null;
    var generated = state.proposals.find(function (item) { return String(item.opportunity_id) === String(active); });
    var sections = state.proposalSections || [];
    var editor = sections.length ? sections.map(function (section, index) {
      return '<div class="proposal-section"><label for="proposal-' + index + '">' + escapeHtml(section.title) +
        '</label><textarea class="textarea" id="proposal-' + index + '" data-proposal-section="' + index + '">' + escapeHtml(section.text) + "</textarea></div>";
    }).join("") : emptyState("Build a structured draft", "Select an opportunity to generate an editable starter proposal. It will use the captured scope and company profile, and flag where verified evidence is missing.");

    document.getElementById("view-proposal").innerHTML =
      pageHead("RESPOND · PROVE · REFINE", "Proposal studio", "A disciplined first draft — never a substitute for the buyer's exact RFP or verified evidence.",
        '<button class="button" data-action="download-proposal"' + (sections.length ? "" : " disabled") + ">↓ Export text</button>" +
        '<button class="button button-primary" data-action="save-proposal"' + (sections.length ? "" : " disabled") + ">Save draft</button>") +
      '<div class="callout"><strong>Truth-before-polish.</strong> ' + (previewMode
        ? "The interactive preview creates a sample structured outline."
        : "Generate proposal draft creates an editable response tailored to the selected opportunity and saved company profile. If an AI key is configured it uses that service; otherwise the Netlify function builds a no-cost structured draft from the notice fields and templates without calling an AI service.") +
        ' It is not a guaranteed or submission-ready bid. Verify every requirement and claim, replace evidence prompts, validate costs and have a human bid lead approve the final submission.</div>' +
      '<div class="proposal-layout"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Technical response</h2><p class="panel-sub">' +
      (current ? escapeHtml(current.title) + " · " + escapeHtml(current.funder) : "Select a real opportunity to start") +
      '</p></div><button class="button button-small button-primary" data-action="generate-proposal"' + (current ? "" : " disabled") +
      ">" + (previewMode ? "Generate outline" : "Generate proposal draft") + "</button></div>" +
      '<div class="panel-pad">' + editor + "</div></article><aside class=\"panel proposal-sidebar\"><div class=\"panel-head\"><div><h2 class=\"panel-title\">Bid readiness</h2><p class=\"panel-sub\">A practical review, not a compliance verdict</p></div></div>" +
      '<div class="panel-body"><select id="proposalSelect" class="select"><option value="">Choose opportunity</option>' + choices.map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '"' + (String(active) === String(item.id) ? " selected" : "") + ">" + escapeHtml(item.title) + "</option>";
      }).join("") + "</select>" + (current ? '<div class="score-ring" style="--score:' + Number(current.fit_score || 0) + '%"><b>' +
        Number(current.fit_score || 0) + "</b></div><div style=\"text-align:center;font-size:9px;color:#8591a4;margin-top:-5px\">Capability screening signal</div>" +
        '<div class="signal-card"><span class="signal-label"><i></i> WHAT TO VERIFY</span><p style="margin-top:7px">' +
        escapeHtml((current.fit_json && current.fit_json.basis) || "Keyword screening only.") + "</p></div>" +
        '<button class="button button-wide" data-action="prepare-interview" data-id="' + escapeHtml(current.id) + '">Prepare interview →</button>' : "") +
      (generated ? '<div class="form-field"><label for="proposalStatus">REVIEW STATUS</label><select id="proposalStatus" class="select"><option' +
        (generated.status === "Draft" ? " selected" : "") + '>Draft</option><option' + (generated.status === "In review" ? " selected" : "") +
        '>In review</option><option' + (generated.status === "Approved" ? " selected" : "") + '>Approved</option></select></div>' : "") +
      '<div class="panel-sub">Review status: ' + escapeHtml(generated ? generated.status : "Not started") +
      (state.user && state.user.role === "writer" ? " · manager approval required" : "") + "</div></div></aside></div>";
  }

  function renderInterview() {
    var active = state.activeOpportunity;
    var current = active ? opportunityById(active) : null;
    var questions = state.interviewQuestions || [];
    var list = questions.length ? questions.map(function (item, index) {
      return '<article class="prep-card"><span class="answer-label">PANEL QUESTION ' + String(index + 1).padStart(2, "0") +
        '</span><h3>' + escapeHtml(item.question) + '</h3><span class="answer-label">Answer framework</span><p>' +
        escapeHtml(item.framework) + "</p></article>";
    }).join("") : emptyState("Prepare with proof, not scripts", "Generate a tailored panel-question pack from a real opportunity. Use it to rehearse concise, evidence-backed answers.");
    document.getElementById("view-interview").innerHTML =
      pageHead("REHEARSE · ALIGN · SHOW PROOF", "Interview room", "Turn the written bid into a clear conversation with the buyer's panel.",
        '<button class="button button-primary" data-action="generate-interview"' + (current ? "" : " disabled") + ">✳ Build prep pack</button>") +
      '<div class="callout"><strong>Keep answers defensible.</strong> The practice prompts are structured from the tender and capability profile. They do not invent customer examples, personnel, results or certifications. Bring approved evidence into the room.</div>' +
      '<article class="panel"><div class="panel-head"><div><h2 class="panel-title">Practice for the panel</h2><p class="panel-sub">' +
      (current ? escapeHtml(current.title) + " · " + escapeHtml(current.funder) : "Choose the opportunity to prepare for") +
      '</p></div><select id="interviewSelect" class="select" style="max-width:260px"><option value="">Choose opportunity</option>' +
      state.opportunities.filter(function (item) { return item.stage !== "Lost" && item.stage !== "NoGo"; }).map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '"' + (String(active) === String(item.id) ? " selected" : "") + ">" + escapeHtml(item.title) + "</option>";
      }).join("") + '</select></div><div class="panel-pad">' + list + "</div></article>";
  }

  function renderDelivery() {
    var projects = state.projects || [];
    if (!["premium", "enterprise"].includes(state.subscription && state.subscription.plan)) {
      document.getElementById("view-delivery").innerHTML =
        pageHead("PORTFOLIO DELIVERY", "Project launch", "Coordinate awarded work and milestone dates across a multi-project portfolio.") +
        '<article class="panel panel-pad"><span class="eyebrow">PREMIUM WORKSPACE</span><h2 class="panel-title">Bring every project into one delivery view.</h2><p class="panel-sub">Upgrade to Premium or Enterprise to access project launch plans, chronological activity and Gantt scheduling.</p><button class="button button-primary" data-action="manage-plan">Compare plans →</button></article>';
      return;
    }
    var content = projects.length ? projects.map(function (project) {
      var complete = project.milestones.filter(function (item) { return item.status === "Done"; }).length;
      var pct = project.milestones.length ? Math.round(complete / project.milestones.length * 100) : 0;
      return '<article class="panel project-card"><div class="project-top"><div><h3>' + escapeHtml(project.opportunity_title) +
        '</h3><p>' + escapeHtml(project.funder) + " · " + escapeHtml(project.project_manager || "Project manager to assign") + " · " +
        dateLabel(project.start_date) + '</p></div><div style="text-align:right">' + money(project.value, project.currency) +
        '<div class="fit-line" style="justify-content:flex-end">' + pct + "% launch controls complete</div></div></div>" +
        renderProjectGantt(project) +
        '<div class="milestone-list">' + project.milestones.map(function (milestone) {
          return '<div class="milestone-row"><div><b>' + escapeHtml(milestone.title) + '</b><small>' +
            (milestone.due_date ? dateLabel(milestone.due_date) : "Set a due date to place this milestone on the Gantt chart") + '</small></div>' +
            '<div class="milestone-controls"><input class="field milestone-date" type="date" aria-label="Due date for ' + escapeHtml(milestone.title) +
            '" value="' + escapeHtml(milestone.due_date || "") + '" data-milestone-date="' + escapeHtml(milestone.id) + '">' +
            '<select class="select" data-milestone="' + escapeHtml(milestone.id) + '"><option' + (milestone.status === "Not started" ? " selected" : "") +
            ">Not started</option><option" + (milestone.status === "In progress" ? " selected" : "") + ">In progress</option><option" +
            (milestone.status === "At risk" ? " selected" : "") + ">At risk</option><option" + (milestone.status === "Done" ? " selected" : "") +
            ">Done</option></select></div></div>";
        }).join("") + "</div></article>";
    }).join("") : emptyState("Build the launch, not just the bid", "After award is confirmed, mark the opportunity Won and create a launch plan. It seeds mobilisation, acceptance, risk, pilot, handover and early-outcome checkpoints.");
    document.getElementById("view-delivery").innerHTML =
      pageHead("AWARD → MOBILISE → MEASURE", "Project launch", "Make the hand-off from bid team to delivery team visible, owned and measurable.",
        '<button class="button" data-nav="opportunities">Review won opportunities →</button>') +
      '<div class="callout"><strong>Start at award confirmation.</strong> Launch plans can only be created from an opportunity your authorised manager has marked Won. Add client-agreed dates and owners after the kick-off.</div>' +
      content;
  }

  function renderLearnings() {
    var container = document.getElementById("view-learnings");
    if (!container) return;
    if (!state.subscription || state.subscription.plan !== "enterprise") {
      container.innerHTML = pageHead("ENTERPRISE · HUMAN-REVIEWED LEARNINGS", "Learning review", "Turn verified bid and delivery feedback into a reusable, reviewable company knowledge base.") +
        '<article class="panel panel-pad"><span class="eyebrow">ENTERPRISE</span><h2 class="panel-title">Learn from real outcomes, not guesses.</h2><p class="panel-sub">Enterprise uses AI to organize notes you provide into a draft learning. A manager reviews every draft before it becomes an approved company lesson.</p><button class="button button-primary" data-action="manage-plan">Compare plans →</button></article>';
      return;
    }
    var canReview = state.user && ["owner", "manager"].includes(state.user.role);
    var entries = (state.learnings || []).map(function (learning) {
      var source = state.opportunities.find(function (item) { return String(item.id) === String(learning.source_opportunity_id); });
      var controls = canReview && learning.status === "draft"
        ? '<div class="page-actions"><button class="button button-primary" data-action="review-learning" data-id="' + escapeHtml(learning.id) + '" data-status="reviewed">Approve reviewed learning</button><button class="button" data-action="review-learning" data-id="' + escapeHtml(learning.id) + '" data-status="archived">Archive draft</button></div>'
        : "";
      return '<article class="panel learning-card"><div class="panel-head"><div><span class="pill ' + (learning.status === "reviewed" ? "green" : "") + '">' +
        escapeHtml(learning.status) + '</span><h2 class="panel-title">' + escapeHtml(learning.title) + '</h2><p class="panel-sub">' +
        escapeHtml(source ? source.title : "Company learning") + " · " + escapeHtml(dateLabel((learning.created_at || "").slice(0, 10))) +
        '</p></div>' + controls + '</div><div class="panel-body"><p class="learning-copy">' + escapeHtml(learning.learning_text) + '</p>' +
        (learning.status === "draft" ? '<div class="warning-note"><b>!</b><div>AI-generated draft. Verify all facts and approve it before anyone reuses it in a proposal or company process.</div></div>' : "") + '</div></article>';
    }).join("") || emptyState("No lessons captured yet", "After a bid outcome or project milestone, record verified feedback to create a draft for review.");
    var form = canReview
      ? '<article class="panel panel-pad"><span class="eyebrow">CAPTURE VERIFIED TEAM FEEDBACK</span><h2 class="panel-title">Create a learning draft</h2><p class="panel-sub">AI receives the notes and selected opportunity below to organize a draft. Do not include personal, confidential or buyer-restricted data unless your organization has approved that use.</p><form id="learningForm"><div class="form-field"><label for="learningOpportunity">RELATED OPPORTUNITY (OPTIONAL)</label><select id="learningOpportunity" name="opportunity_id" class="select"><option value="">Company-wide learning</option>' +
        state.opportunities.map(function (item) { return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.title) + '</option>'; }).join("") +
        '</select></div><div class="form-field"><label for="learningNotes">FACTS, FEEDBACK AND EVIDENCE TO REVIEW *</label><textarea id="learningNotes" name="notes" class="textarea" required maxlength="5000" placeholder="What happened? What worked or did not? Include only facts your team can verify."></textarea></div><div id="learningFormError" class="form-error" role="alert"></div><button class="button button-primary" type="submit">Generate draft for human review →</button></form></article>'
      : '<div class="callout"><strong>Manager review required.</strong> Ask your workspace owner or project manager to add or approve learning records.</div>';
    container.innerHTML = pageHead("ENTERPRISE · EVIDENCE · IMPROVEMENT", "Learning review", "Build an organization-owned knowledge base from verified bid feedback and project outcomes.") +
      '<div class="callout"><strong>Human approval stays in control.</strong> AI drafts are not approved automatically and are not written back into your company profile.</div>' + form + entries;
  }

  function renderProjectGantt(project) {
    var dated = (project.milestones || []).filter(function (milestone) { return milestone.due_date; });
    if (!project.start_date && !dated.length) {
      return '<div class="gantt-empty">Add a project start date and milestone due dates to build a realistic schedule.</div>';
    }
    var points = (project.start_date ? [project.start_date] : []).concat(dated.map(function (milestone) { return milestone.due_date; }));
    var dates = points.map(function (value) { return Date.parse(value + "T00:00:00Z"); }).filter(Number.isFinite);
    if (!dates.length) return '<div class="gantt-empty">Add dates to build the delivery schedule.</div>';
    var start = Math.min.apply(Math, dates);
    var end = Math.max.apply(Math, dates);
    var span = Math.max(86400000, end - start);
    var rows = dated.map(function (milestone) {
      var position = Math.max(0, Math.min(98, (Date.parse(milestone.due_date + "T00:00:00Z") - start) / span * 98));
      var statusClass = milestone.status === "Done" ? "done" : milestone.status === "At risk" ? "risk" : milestone.status === "In progress" ? "progress" : "";
      return '<div class="gantt-row"><span>' + escapeHtml(milestone.title) + '</span><div class="gantt-track"><i class="' + statusClass +
        '" style="left:' + position + '%" title="' + escapeHtml(dateLabel(milestone.due_date)) + '"></i></div></div>';
    }).join("");
    return '<div class="gantt-wrap"><div class="gantt-head"><b>DELIVERY GANTT</b><span>' + escapeHtml(dateLabel(new Date(start).toISOString().slice(0, 10))) +
      " → " + escapeHtml(dateLabel(new Date(end).toISOString().slice(0, 10))) + '</span></div>' + (rows || '<div class="gantt-empty">Set milestone due dates to map delivery checkpoints.</div>') + '</div>';
  }

  function profileFields(profile) {
    function lines(key) { return Array.isArray(profile[key]) ? profile[key].join("\n") : ""; }
    return '<div class="onboarding-grid"><div class="form-field"><label for="profileName">LEGAL / TRADING NAME *</label><input id="profileName" class="field" maxlength="160" required value="' + escapeHtml(profile.legal_name || "") + '"></div>' +
      '<div class="form-field"><label for="profileWebsite">COMPANY WEBSITE</label><input id="profileWebsite" class="field" maxlength="240" type="url" placeholder="https://…" value="' + escapeHtml(profile.website || "") + '"></div>' +
      '<div class="form-field onboarding-full"><label for="profilePitch">COMPANY SUMMARY</label><textarea id="profilePitch" class="textarea" maxlength="1200" placeholder="What your company delivers, for whom, and where">' + escapeHtml(profile.pitch || "") + '</textarea></div>' +
      '<div class="form-field"><label for="profileCapabilities">CAPABILITIES · ONE PER LINE *</label><textarea id="profileCapabilities" class="textarea" required placeholder="Services and delivery strengths">' + escapeHtml(lines("capabilities")) + '</textarea></div>' +
      '<div class="form-field"><label for="profileKeywords">SEARCH KEYWORDS · ONE PER LINE *</label><textarea id="profileKeywords" class="textarea" required placeholder="Terms buyers use in notices">' + escapeHtml(lines("preferred_keywords")) + '</textarea></div>' +
      '<div class="form-field"><label for="profileSectors">TARGET SECTORS · ONE PER LINE</label><textarea id="profileSectors" class="textarea" placeholder="e.g. Education, public health, digital government">' + escapeHtml(lines("preferred_sectors")) + '</textarea></div>' +
      '<div class="form-field"><label for="profilePreferredCountries">TARGET COUNTRIES / MARKETS · ONE PER LINE</label><textarea id="profilePreferredCountries" class="textarea" placeholder="Countries where you want to pursue work">' + escapeHtml(lines("preferred_countries")) + '</textarea></div>' +
      '<div class="form-field"><label for="profileBuyerTypes">PREFERRED BUYER TYPES · ONE PER LINE</label><textarea id="profileBuyerTypes" class="textarea" placeholder="UN agencies, government, NGOs, development banks">' + escapeHtml(lines("preferred_buyer_types")) + '</textarea></div>' +
      '<div class="form-field"><label for="profileCountries">VERIFIED OPERATING MARKETS · ONE PER LINE</label><textarea id="profileCountries" class="textarea" placeholder="Markets where your company can actually operate">' + escapeHtml(lines("operating_countries")) + '</textarea></div>' +
      '<div class="form-field onboarding-full"><label for="profileCases">VERIFIED CASE STUDIES / OUTCOMES · ONE PER LINE</label><textarea id="profileCases" class="textarea" placeholder="Client-approved reference · scope · date · measured outcome">' + escapeHtml(lines("case_studies")) + '</textarea></div>' +
      '<div class="form-field onboarding-full"><label for="profileCerts">CERTIFICATIONS / REGISTRATIONS · ONE PER LINE</label><textarea id="profileCerts" class="textarea" placeholder="Credential · issuer · expiry">' + escapeHtml(lines("certifications")) + '</textarea></div></div>';
  }

  function renderOnboarding() {
    var onboarding = document.getElementById("view-onboarding");
    if (!state.user || !["owner", "manager"].includes(state.user.role)) {
      onboarding.innerHTML = '<article class="panel onboarding-card"><img src="assets/nexa-mark.svg" width="48" height="48" alt="NEXA"><span class="eyebrow">NEXA BIDOPS · WORKSPACE SETUP</span><h1>Company profile needed</h1><p class="onboarding-intro">Your organization needs a completed company profile before the opportunity radar can personalize search and match explanations. Contact your workspace owner or project manager to complete it.</p><div class="onboarding-note">This profile is shared by your organization. Personal sign-up is invitation-only, and employees do not create separate company profiles.</div><button class="button" data-action="logout">Sign out</button></article>';
      return;
    }
    onboarding.innerHTML = '<article class="panel onboarding-card"><img src="assets/nexa-mark.svg" width="48" height="48" alt="NEXA"><span class="eyebrow">A PERSONALIZED WORKSPACE STARTS HERE</span><h1>Tell us what your company can win.</h1><p class="onboarding-intro">Set your verified capabilities and the opportunities you want to pursue. NEXA BidOps uses this shared company profile to shape search links, screen notices, and explain each profile-match score.</p><div class="onboarding-note">Your match score is a text-alignment signal only. It is not a legal eligibility check, compliance decision, or probability of winning. Verify every requirement against the buyer’s complete notice.</div><form id="companyProfileForm">' +
      profileFields(state.profile || {}) +
      '<p class="panel-sub">Only enter claims your company can verify. You can update these settings later in Company evidence.</p><div id="profileFormError" class="form-error" role="alert"></div><div class="onboarding-actions"><button class="button button-primary" type="submit">Save profile and open workspace →</button></div></form></article>';
  }

  function renderProfile() {
    var profile = state.profile || {};
    document.getElementById("view-profile").innerHTML =
      pageHead("CAPABILITY · CREDENTIALS · PROOF", "Company evidence", "This shared organization profile shapes discovery and match explanations.",
        state.user && (state.user.role === "owner" || state.user.role === "manager") ? '<button class="button button-primary" data-action="save-profile">Save company profile</button>' : "") +
      '<div class="warning-note"><b>!</b><div><strong>Verify before external use.</strong> Search and match scores rely on the details entered here. Confirm company capabilities, market coverage, references, registrations and credentials before using them in a proposal.</div></div>' +
      '<article class="panel panel-pad">' + profileFields(profile) +
      '<div class="signal-card"><span class="signal-label"><i></i> EVIDENCE RULE</span><h3>Claim → owner → source → approval</h3><p>Maintain that chain for each credential, metric, client reference, CV and financial figure used in a submission.</p></div>' +
      '<p class="panel-sub">' + escapeHtml(profile.positioning_note || "Verify every claim before external use.") + "</p></article>";
  }

  function renderTeam() {
    var canManageTeam = state.user && ["owner", "manager"].includes(state.user.role);
    if (!canManageTeam) {
      document.getElementById("view-team").innerHTML = emptyState("Admin access required", "Only the CEO / workspace owner and authorized project managers can manage staff access.");
      return;
    }
    var members = (state.users || []).slice().sort(function (a, b) {
      return String(a.display_name || "").localeCompare(String(b.display_name || ""));
    });
    var rows = members.length ? members.map(function (member) {
      var protectedAccount = member.role === "owner" || member.user_id === state.user.id ||
        (state.user.role !== "owner" && member.role !== "writer");
      var roleOptions = state.user.role === "owner" ? ["manager", "writer"] : ["writer"];
      var roleControl = member.role === "owner" ? '<span class="pill blue">Owner</span>' :
        '<select class="select" data-user-role="' + escapeHtml(member.user_id) + '"' +
        (protectedAccount ? " disabled" : "") + ">" + roleOptions.map(function (role) {
          return '<option value="' + role + '"' + (member.role === role ? " selected" : "") + ">" + (role === "manager" ? "Project manager" : "Staff") + "</option>";
        }).join("") + "</select>";
      var status = member.active ? '<span class="team-status"><i></i>Active</span>' : '<span class="team-status inactive"><i></i>Inactive</span>';
      return "<tr><td><div class=\"team-person\"><span class=\"avatar\">" + escapeHtml((member.display_name || member.email || "?").slice(0, 1).toUpperCase()) +
        "</span><div><b>" + escapeHtml(member.display_name || "Workspace member") + '</b><div class="opp-meta">' + escapeHtml(member.email || "Email not recorded") +
        "</div></div></div></td><td>" + roleControl + "</td><td>" + status + '</td><td>' +
        (member.role === "owner" || member.user_id === state.user.id || (state.user.role !== "owner" && member.role !== "writer") ? "—" :
          '<button class="button button-small" data-action="toggle-user" data-id="' + escapeHtml(member.user_id) + '" data-active="' + String(!member.active) + '">' +
          (member.active ? "Deactivate" : "Reactivate") + "</button>") + "</td></tr>";
    }).join("") : '<tr><td colspan="4">' + emptyState("No staff accounts yet", "Invite a staff member by email. They will receive a private link to set their own password.") + "</td></tr>";
    document.getElementById("view-team").innerHTML =
      pageHead("ADMIN · PEOPLE · ACCESS", "Team access", "Invite staff, set least-privilege roles and turn off access when someone leaves.",
        '<span class="pill">' + members.filter(function (member) { return member.active; }).length + " active accounts</span>") +
      (previewMode ? '<div class="callout"><strong>Preview mode.</strong> Invitations are not emailed; changes stay in this browser session.</div>' :
        '<div class="callout"><strong>Private invitations.</strong> Staff receive an email invitation and set their own password. Public sign-up is disabled; manager invitations are limited to the workspace owner.</div>') +
      '<div class="team-layout"><article class="panel team-table"><div class="panel-head"><div><h2 class="panel-title">Workspace members</h2><p class="panel-sub">Owner accounts are protected from changes here.</p></div></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>' + rows +
      "</tbody></table></div></article><article class=\"panel panel-pad\"><h2 class=\"panel-title\">Invite a team member</h2><p class=\"panel-sub\">No shared passwords. Each person activates their own account.</p>" +
      '<form id="staffInviteForm" class="team-invite"><div class="form-field"><label for="staffName">FULL NAME</label><input id="staffName" name="display_name" class="field" required maxlength="120" autocomplete="name" placeholder="Staff member name"></div>' +
      '<div class="form-field"><label for="staffEmail">WORK EMAIL</label><input id="staffEmail" name="email" class="field" type="email" required maxlength="254" autocomplete="email" placeholder="name@company.com"></div>' +
      '<div class="form-field"><label for="staffRole">WORKSPACE ROLE</label><select id="staffRole" name="role" class="select"><option value="writer">Staff · draft and update bids</option>' +
      (state.user.role === "owner" ? '<option value="manager">Project manager · administer team and pipeline</option>' : "") +
      '</select></div><p class="team-note">Staff can work on bids but cannot manage accounts or change company-wide settings. Assign project manager access only when needed.</p>' +
      '<div id="staffInviteError" class="form-error" role="alert"></div><button class="button button-primary" type="submit">Send private invitation →</button></form></article></div>';
  }

  function render() {
    var onboardingRequired = !state.profile || state.profile.onboarding_complete !== true;
    document.getElementById("appShell").classList.toggle("onboarding", onboardingRequired);
    if (onboardingRequired) {
      renderOnboarding();
    } else {
      document.getElementById("view-onboarding").innerHTML = "";
      renderDashboard();
      renderOpportunities();
      renderPipeline();
      renderReports();
      renderProposal();
      renderInterview();
      renderDelivery();
      renderLearnings();
      renderProfile();
      renderTeam();
      document.querySelectorAll(".view").forEach(function (element) {
        element.classList.toggle("active", element.id === "view-" + state.tab);
      });
      document.querySelectorAll(".nav-item").forEach(function (element) {
        element.classList.toggle("active", element.dataset.nav === state.tab);
      });
    }
    document.getElementById("navOppCount").textContent = String(state.opportunities.length);
    document.getElementById("crumb").textContent = pageNames[state.tab] || pageNames.dashboard;
    document.getElementById("today").textContent = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    document.querySelector(".topbar [data-action='new-opportunity']").hidden =
      !state.user || !["owner", "manager"].includes(state.user.role);
    document.getElementById("teamNav").hidden =
      !state.user || !["owner", "manager"].includes(state.user.role);
  }

  function loadWorkspace() {
    return request("bootstrap").then(function (data) {
      state.csrf = data.csrf;
      state.user = data.user;
      state.profile = data.profile;
      state.subscription = data.subscription || null;
      state.opportunities = data.opportunities || [];
      state.projects = data.projects || [];
      state.proposals = data.proposals || [];
      state.learnings = data.learnings || [];
      state.activity = data.activity || [];
      state.latestDiscovery = data.latest_discovery || null;
      if (state.subscription && !["active", "trialing"].includes(state.subscription.status)) {
        openPlanScreen("Your seven-day trial has ended. Choose a subscription plan to restore workspace access.");
        return;
      }
      document.getElementById("loginScreen").hidden = true;
      document.getElementById("appShell").hidden = false;
      var teamRequest = state.user && ["owner", "manager"].includes(state.user.role)
        ? request("users").then(function (members) { state.users = members.users || []; })
        : Promise.resolve();
      return teamRequest.then(function () { render(); });
    });
  }

  function authView(view) {
    document.getElementById("loginForm").hidden = view !== "login";
    document.getElementById("signupForm").hidden = view !== "signup";
    document.getElementById("planScreen").hidden = view !== "plans";
  }

  function openPlanScreen(message) {
    document.getElementById("appShell").hidden = true;
    document.getElementById("loginScreen").hidden = false;
    authView("plans");
    document.getElementById("planMessage").textContent = message || "";
    var trialAvailable = state.subscription && state.subscription.status === "trialing";
    document.querySelectorAll(".plan-trial").forEach(function (button) { button.hidden = !trialAvailable; });
  }

  function startPlanTrial(plan, button) {
    var message = document.getElementById("planMessage");
    message.textContent = "";
    if (!previewMode && !window.sessionStorage.getItem("afc_access_token")) {
      message.textContent = "Confirm your email and sign in before choosing a plan.";
      return;
    }
    setBusy(button, true, "Saving plan…");
    request("subscription", { method: "PATCH", body: { plan: plan } }).then(function (result) {
      state.subscription = result.subscription;
      if (previewMode) {
        return loadWorkspace().then(function () { notify("Preview plan updated."); });
      }
      if (!window.sessionStorage.getItem("afc_access_token")) {
        message.textContent = "Your seven-day trial is running. Confirm your email, then sign in to continue.";
        return;
      }
      window.sessionStorage.removeItem("afc_pending_plan_selection");
      window.localStorage.removeItem("afc_pending_signup_email");
      return loadWorkspace().then(function () { notify("Your seven-day trial is ready."); });
    }).catch(function (error) {
      message.textContent = error.message;
    }).finally(function () { setBusy(button, false); });
  }

  function startCheckout(provider, plan, button) {
    var message = document.getElementById("planMessage");
    message.textContent = "";
    if (previewMode) {
      message.textContent = "Payment checkout is not available in the browser-only preview.";
      return;
    }
    if (!window.sessionStorage.getItem("afc_access_token")) {
      message.textContent = "Confirm your email and sign in before starting checkout.";
      return;
    }
    setBusy(button, true, "Opening secure checkout…");
    var payload = { provider: provider, plan: plan };
    if (provider === "mpesa") payload.phone = document.getElementById("mpesaPhone").value;
    request("checkout", { method: "POST", body: payload }).then(function (result) {
      window.sessionStorage.removeItem("afc_pending_plan_selection");
      window.localStorage.removeItem("afc_pending_signup_email");
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      message.textContent = result.message || "Approve the M-Pesa prompt on your phone. NEXA will activate your account after payment confirmation.";
      if (provider === "mpesa") {
        setBusy(button, false);
        var attempts = 0;
        var oldSubscription = state.subscription || {};
        var timer = window.setInterval(function () {
          attempts += 1;
          request("subscription").then(function (status) {
            var current = status.subscription;
            var renewed = current && current.status === "active" &&
              (oldSubscription.status !== "active" ||
                Date.parse(current.current_period_end || "") > Date.parse(oldSubscription.current_period_end || ""));
            if (renewed) {
              window.clearInterval(timer);
              state.subscription = current;
              loadWorkspace().then(function () { notify("Payment confirmed. Your account is active."); })
                .catch(function (error) { notify(error.message, true); });
            }
          }).catch(function (error) {
            window.clearInterval(timer);
            message.textContent = error.message;
          });
          if (attempts >= 30) {
            window.clearInterval(timer);
            message.textContent = "Payment confirmation is still pending. Refresh your workspace in a moment or contact support if you were charged.";
          }
        }, 5000);
      }
    }).catch(function (error) {
      message.textContent = error.message;
      setBusy(button, false);
    });
  }

  function startPreview() {
    previewMode = true;
    demo.nextId = 11;
    demo.nextMilestone = 100;
    var days = function (amount) {
      var date = new Date();
      date.setDate(date.getDate() + amount);
      return date.toISOString().slice(0, 10);
    };
    state.csrf = "";
    state.user = { id: "preview-owner", username: "preview", display_name: "Interactive Preview", role: "owner" };
    state.profile = {
      legal_name: "",
      website: "",
      pitch: "",
      capabilities: [],
      operating_countries: [],
      preferred_countries: [],
      preferred_sectors: [],
      preferred_keywords: [],
      preferred_buyer_types: [],
      case_studies: [],
      certifications: [],
      onboarding_complete: false,
      positioning_note: "Preview workspace. No company claims, references or credentials have been verified.",
    };
    state.subscription = { plan: "enterprise", status: "trialing", trial_started_at: new Date().toISOString(), trial_ends_at: days(7) + "T23:59:59.000Z" };
    state.opportunities = [
      { id: 1, title: "Mobile learning package for community health teams", funder: "UN health programme · buyer", funder_type: "UN agency", sector: "Health & learning", country: "Kenya", currency: "USD", value: 85000, deadline: days(6), stage: "GoNoGo", requirements: "scope: design 18 mobile-first learning modules, scenario-based assessments and a SCORM package for an existing LMS. Localise selected content into two languages. Mandatory checks: country eligibility, safeguarding approach, two comparable references, named instructional-design lead and signed declarations.", owner: "Amina · Bid lead", notes: "deadline/value; no live notice or buyer relationship. Next: confirm local partner eligibility and evidence for two references.", fit_score: 82, fit_json: { matched: ["Digital learning content", "Microlearning", "SCORM"], review: ["Verify translation capacity and safeguarding evidence."], basis: "keyword screen only. Confirm mandatory eligibility and evidence manually." } },
      { id: 2, title: "LMS migration and administrator enablement", funder: "regional development programme · buyer", funder_type: "Development bank", sector: "Digital learning", country: "Uganda", currency: "USD", value: 120000, deadline: days(18), stage: "Drafting", requirements: "scope: migrate 140 existing courses to a buyer-selected LMS, preserve learner records, run accessibility and QA checks, train 12 administrators and provide a 60-day hypercare plan. Evaluation emphasizes methodology, comparable migration evidence, team and total cost.", owner: "Daniel · Proposal lead", notes: "Draft needs an evidenced migration case study, named technical lead, assumptions and priced support period.", fit_score: 76, fit_json: { matched: ["LMS migration", "Administrator training", "Cloud services"], review: ["Verify access to the named platform and data-protection requirements."], basis: "keyword screen only. Confirm mandatory eligibility and evidence manually." } },
      { id: 3, title: "Teacher professional development pilot", funder: "education foundation · buyer", funder_type: "Foundation", sector: "Education", country: "Tanzania", currency: "USD", value: 95000, deadline: days(-35), stage: "Won", requirements: "awarded scope: develop blended teacher training for 40 schools, accessible mobile lessons, facilitator materials and a baseline/endline learning assessment. Buyer-approved launch plan tracks acceptance gates, school onboarding, pilot feedback and handover.", owner: "Grace · Project manager", notes: "award and project. Demonstrates the bid-to-delivery handoff; not a claim of company performance.", fit_score: 88, fit_json: { matched: ["Teacher development", "Digital learning", "Learning assessment"], review: [], basis: "keyword screen only. award; no performance claim." } },
      { id: 4, title: "Print-and-hardware supply tender · poor fit", funder: "county procurement unit · buyer", funder_type: "Government", sector: "Goods & supply", country: "Kenya", currency: "KES", value: 5400000, deadline: days(3), stage: "NoGo", requirements: "scope is predominantly printing, laptop supply, delivery logistics and a mandatory site visit. Included to demonstrate a documented no-go decision rather than a recommended bid.", owner: "Amina · Bid lead", notes: "Poor fit: goods-heavy scope, logistics exposure and mandatory in-person site visit without evidence of supply capacity.", fit_score: 12, fit_json: { matched: [], review: ["Goods-heavy tender; confirm capacity only if verified."], basis: "keyword screen only. No-go shown as an example of disciplined qualification." } },
      { id: 5, title: "Digital courseware for agricultural extension", funder: "East Africa NGO consortium · buyer", funder_type: "NGO / INGO", sector: "Agriculture & learning", country: "Uganda", currency: "USD", value: 64000, deadline: days(12), stage: "Review", requirements: "scope: convert 10 extension guides into short, low-bandwidth lessons; create facilitator notes and formative quizzes; pilot with 3 districts. Review checks technical response against the scoring matrix, delivery calendar, accessibility, localization and milestone-based budget.", owner: "Daniel · Proposal lead", notes: "Peer review due in 2 days. Outstanding check: confirm the buyer accepts the proposed content formats.", fit_score: 79, fit_json: { matched: ["Courseware development", "Low-bandwidth learning", "Training content"], review: ["Confirm preferred content format and pilot language."], basis: "keyword screen only. Confirm mandatory eligibility and evidence manually." } },
      { id: 6, title: "Cybersecurity awareness learning programme", funder: "public digital service · buyer", funder_type: "Government", sector: "Cybersecurity", country: "Rwanda", currency: "USD", value: 42000, deadline: days(-4), stage: "Submitted", requirements: "submitted scope: role-based security awareness modules, simulated decision scenarios, learner completion reporting and handover of editable source files. Submission checklist: technical response, budget, team CVs, declarations and receipt confirmation.", owner: "Amina · Bid lead", notes: "Shown as submitted; a submission receipt and buyer decision must be recorded only in a real workspace.", fit_score: 73, fit_json: { matched: ["Cybersecurity awareness", "Learning content", "Reporting"], review: ["For a real bid, verify submission receipt and buyer communication."], basis: "keyword screen only. submission." } },
      { id: 7, title: "Cloud learning portal managed support", funder: "regional skills initiative · buyer", funder_type: "Foundation", sector: "Cloud services", country: "Kenya", currency: "USD", value: 38000, deadline: days(-62), stage: "Lost", requirements: "lost bid: provide 12 months of managed cloud support, service reporting, backup checks and escalation. Retrospective example records a gap in independently verifiable SLA and uptime evidence.", owner: "Daniel · Proposal lead", notes: "outcome. Learning: attach verified service-level evidence and clarify after-hours coverage before bidding.", fit_score: 68, fit_json: { matched: ["Cloud services", "Operations support"], review: ["Evidence gap: service-level and uptime references."], basis: "keyword screen only. loss." } },
      { id: 8, title: "LMS content accessibility and QA framework", funder: "education technology partner · buyer", funder_type: "Corporate", sector: "Digital learning", country: "Kenya", currency: "USD", value: 52000, deadline: days(24), stage: "Discovered", requirements: "scope: audit 75 learning modules for accessibility, mobile usability, broken links and assessment clarity; produce a prioritized remediation backlog and corrected modules. Next actions: locate original notice, confirm WCAG requirements, buyer timeline and supplier eligibility.", owner: "Unassigned", notes: "Discovery record intentionally awaits source verification and a named bid owner.", fit_score: 71, fit_json: { matched: ["Learning content QA", "Accessibility", "Digital learning"], review: ["Notice source, deadline and required accessibility standard need verification."], basis: "keyword screen only. Confirm mandatory eligibility and evidence manually." } },
      { id: 9, title: "Digital skills curriculum and trainer toolkit", funder: "workforce development programme · buyer", funder_type: "Development bank", sector: "Workforce development", country: "Uganda", currency: "USD", value: 73000, deadline: days(31), stage: "Drafting", requirements: "scope: map digital skills outcomes to a 6-week blended curriculum, create trainer guides and practical assessments, and prepare a train-the-trainer delivery plan. Draft outline is in progress; cost model and trainer CVs remain open.", owner: "Grace · Bid lead", notes: "Next actions: validate learner assumptions, assign an approved trainer and complete budget review.", fit_score: 80, fit_json: { matched: ["Curriculum design", "Trainer enablement", "Assessment"], review: ["Verify trainer availability and comparable curriculum evidence."], basis: "keyword screen only. Confirm mandatory eligibility and evidence manually." } },
      { id: 10, title: "Programme monitoring and learning analytics support", funder: "regional public-sector programme · buyer", funder_type: "NGO / INGO", sector: "Programme delivery", country: "Rwanda", currency: "USD", value: 31000, deadline: days(-81), stage: "Won", requirements: "award: configure learning indicators, dashboard definitions, monthly data-quality checks and a handover workshop. Delivery status shows mobilisation complete and baseline indicator definitions in progress.", owner: "Grace · Project manager", notes: "award. No real buyer, project, award value or company result is implied.", fit_score: 77, fit_json: { matched: ["Programme monitoring", "Learning analytics", "Capacity building"], review: [], basis: "keyword screen only. award; no performance claim." } },
    ];
    state.projects = [
      { id: 1, opportunity_id: 3, opportunity_title: state.opportunities[2].title, funder: state.opportunities[2].funder, currency: "USD", value: 95000, status: "Mobilising", project_manager: "Grace · Project manager", start_date: days(-18), milestones: [
        { id: 1, title: "Kick-off and mobilisation", status: "Done", due_date: days(-16) },
        { id: 2, title: "Requirements and acceptance baseline", status: "Done", due_date: days(-11) },
        { id: 3, title: "Delivery plan and risk register", status: "In progress", due_date: days(2) },
        { id: 4, title: "Pilot / readiness review", status: "Not started", due_date: days(24) },
        { id: 5, title: "Launch and stakeholder handover", status: "Not started", due_date: days(42) },
        { id: 6, title: "30-day outcomes review", status: "Not started", due_date: days(72) },
      ] },
      { id: 2, opportunity_id: 10, opportunity_title: state.opportunities[9].title, funder: state.opportunities[9].funder, currency: "USD", value: 31000, status: "Mobilising", project_manager: "Daniel · Project manager", start_date: days(-8), milestones: [
        { id: 7, title: "Kick-off and mobilisation", status: "Done", due_date: days(-7) },
        { id: 8, title: "Requirements and acceptance baseline", status: "In progress", due_date: days(4) },
        { id: 9, title: "Delivery plan and risk register", status: "Not started", due_date: days(12) },
        { id: 10, title: "Pilot / readiness review", status: "Not started", due_date: days(28) },
        { id: 11, title: "Launch and stakeholder handover", status: "Not started", due_date: days(45) },
        { id: 12, title: "30-day outcomes review", status: "Not started", due_date: days(75) },
      ] },
    ];
    state.proposals = [
      { id: 2, opportunity_id: 2, status: "Draft", opportunity_title: state.opportunities[1].title, sections_json: [
        { title: "Executive summary", text: "Position a phased course migration and administrator enablement plan against the scope. Confirm the buyer, inventory, hosting model, learner-record retention and acceptance conditions before use." },
        { title: "Technical approach", text: "1. Confirm course inventory, metadata and migration rules. 2. Run a small representative migration. 3. Validate completion tracking, accessibility and learner records. 4. Migrate in controlled batches with rollback checkpoints. 5. Train administrators and hand over runbooks. Each step requires verified platform access and buyer sign-off." },
        { title: "Work plan and quality gates", text: "Discovery and inventory → pilot migration → batch migration and QA → administrator enablement → hypercare and handover. Add named owners, buyer-agreed dates, acceptance criteria, risk controls and a fully costed resource plan." },
      ] },
      { id: 5, opportunity_id: 5, status: "In review", opportunity_title: state.opportunities[4].title, sections_json: [
        { title: "Executive summary", text: "Translate extension guidance into usable, low-bandwidth learning assets and a district pilot. Validate the buyer's audience, languages, devices and success measures." },
        { title: "Review checklist", text: "Confirm the scoring matrix; validate content rights and source materials; check language capacity; map deliverables to dates and budget; attach only approved staff CVs and comparable references." },
      ] },
      { id: 6, opportunity_id: 6, status: "Approved", opportunity_title: state.opportunities[5].title, sections_json: [
        { title: "Executive summary", text: "The bid proposes short, role-specific awareness modules with scenarios and completion reporting. Verify all company credentials, scope assumptions and buyer requirements before any external use." },
        { title: "Submission control", text: "review status only. In a real workspace, record the submission receipt, final approved files, authorized signatory and buyer follow-up dates." },
      ] },
    ];
    state.activity = [
      { action: "timeline_event", entity_type: "timeline", entity_id: 3, detail_json: { event_type: "confirmation_received", opportunity_id: 3, summary: "Buyer confirmed the project kick-off date.", contact: "Buyer programme lead", details: "Example only · confirm dates from the actual buyer." }, display_name: "Grace · Project manager", created_at: new Date(Date.now() - 45 * 60000).toISOString() },
      { action: "timeline_event", entity_type: "timeline", entity_id: 3, detail_json: { event_type: "vendor_update_sent", opportunity_id: 3, summary: "Sent the vendor a mobilisation and onboarding update.", contact: "Delivery partner", details: "Example only · update shared owners and next steps." }, display_name: "Grace · Project manager", created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
      { action: "launch_plan", entity_type: "project", entity_id: 2, detail_json: { opportunity_id: 3 }, display_name: "Grace · Project manager", created_at: new Date(Date.now() - 7 * 3600000).toISOString() },
      { action: "timeline_event", entity_type: "timeline", entity_id: 1, detail_json: { event_type: "email_response_received", opportunity_id: 1, summary: "Buyer requested clarification on the delivery approach.", contact: "Procurement contact", details: "Example only · record the actual question and response owner." }, display_name: "Amina · Bid lead", created_at: new Date(Date.now() - 30 * 3600000).toISOString() },
      { action: "timeline_event", entity_type: "timeline", entity_id: 1, detail_json: { event_type: "email_sent", opportunity_id: 1, summary: "Submitted the bid and requested receipt confirmation.", contact: "Buyer procurement inbox", details: "Example only · store the submission receipt with the real bid." }, display_name: "Amina · Bid lead", created_at: new Date(Date.now() - 36 * 3600000).toISOString() },
      { action: "generate", entity_type: "proposal", entity_id: 1, detail_json: { opportunity_id: 1 }, display_name: "Daniel · Proposal lead", created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
      { action: "stage_change", entity_type: "opportunity", entity_id: 1, detail_json: { from: "Discovered", to: "GoNoGo" }, display_name: "Amina · Bid lead", created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
      { action: "auto_discover", entity_type: "discovery", entity_id: "preview-run", display_name: "Daily public-source discovery", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    ];
    state.users = [
      { user_id: "preview-owner", email: "ceo@example.test", display_name: "Workspace owner", role: "owner", active: true, created_at: new Date().toISOString() },
      { user_id: "preview-manager", email: "manager@example.test", display_name: "Grace · Project manager", role: "manager", active: true, created_at: new Date().toISOString() },
      { user_id: "preview-writer", email: "writer@example.test", display_name: "Daniel · Proposal lead", role: "writer", active: true, created_at: new Date().toISOString() },
      { user_id: "preview-inactive", email: "former.staff@example.test", display_name: "Inactive staff account", role: "writer", active: false, created_at: new Date().toISOString() },
    ];
    state.activeOpportunity = null;
    state.activeProposal = null;
    state.proposalSections = [];
    state.interviewQuestions = [];
    state.search = "";
    state.stage = "";
    state.sector = "";
    state.sourceCapability = "learning";
    state.sourceMarket = "east";
    document.getElementById("loginError").textContent = "";
    return loadWorkspace();
  }

  function handleBillingReturn() {
    var billing = new URLSearchParams(window.location.search).get("billing");
    if (!billing) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    if (billing === "cancelled") {
      notify("Checkout was cancelled. No subscription change was confirmed.");
      return;
    }
    if (billing !== "success") return;
    var attempts = 0;
    var check = function () {
      request("subscription").then(function (result) {
        var current = result.subscription;
        if (current && current.status === "active") {
          state.subscription = current;
          return loadWorkspace().then(function () { notify("Payment confirmed. Your account is active."); });
        }
        attempts += 1;
        if (attempts >= 30) {
          notify("Payment confirmation is still processing. Refresh in a moment or contact support if you were charged.");
          return;
        }
        window.setTimeout(check, 3000);
      }).catch(function (error) { notify(error.message, true); });
    };
    check();
  }

  function consumeSupabaseAuthRedirect() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    var queryParams = new URLSearchParams(window.location.search);
    var error = params.get("error_description") || params.get("error") ||
      queryParams.get("error_description") || queryParams.get("error");
    if (error) {
      window.history.replaceState(null, "", window.location.pathname);
      return { error: "Email confirmation could not be completed. Request a fresh confirmation email and try again." };
    }

    var accessToken = params.get("access_token");
    var refreshToken = params.get("refresh_token");
    if (!accessToken) return { signupConfirmation: false };

    window.sessionStorage.setItem("afc_access_token", accessToken);
    if (refreshToken) window.sessionStorage.setItem("afc_refresh_token", refreshToken);
    var expiresAtValue = params.get("expires_at");
    var expiresAt = expiresAtValue ? Number(expiresAtValue) : NaN;
    var expiresIn = params.get("expires_in");
    if (!Number.isFinite(expiresAt) && expiresIn && Number.isFinite(Number(expiresIn))) {
      expiresAt = Math.floor(Date.now() / 1000) + Number(expiresIn);
    }
    if (Number.isFinite(expiresAt)) window.sessionStorage.setItem("afc_token_expires_at", String(expiresAt));

    var signupConfirmation = params.get("type") === "signup";
    if (signupConfirmation) window.sessionStorage.setItem("afc_pending_plan_selection", "true");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return { signupConfirmation: signupConfirmation };
  }

  function resumePendingPlanSelection() {
    if (window.sessionStorage.getItem("afc_pending_plan_selection") === "true" &&
        state.subscription && state.subscription.status === "trialing") {
      openPlanScreen("Email confirmed. Choose a package to start your seven-day trial, or subscribe now.");
      window.localStorage.removeItem("afc_pending_signup_email");
      return true;
    }
    return false;
  }

  function signInRequired() {
    state.user = null;
    state.opportunities = [];
    state.users = [];
    document.getElementById("appShell").hidden = true;
    document.getElementById("loginScreen").hidden = false;
    authView("login");
  }

  function showSignIn(error) {
    signInRequired();
    document.getElementById("loginError").textContent = error || "";
    var form = document.getElementById("loginForm");
    if (form) form.reset();
    authView("login");
  }

  function setTab(tab) {
    if (!pageNames[tab]) return;
    if (tab === "team" && (!state.user || !["owner", "manager"].includes(state.user.role))) {
      notify("Admin access is required to manage staff accounts.", true);
      return;
    }
    state.tab = tab;
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").classList.remove("open");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showModal(content) {
    document.getElementById("modalContent").innerHTML = content;
    document.getElementById("modal").hidden = false;
    document.body.style.overflow = "hidden";
    var focusable = document.querySelector("#modal input, #modal select, #modal textarea, #modal button:not(.modal-close)");
    if (focusable) focusable.focus();
  }

  function closeModal() {
    document.getElementById("modal").hidden = true;
    document.getElementById("modalContent").innerHTML = "";
    document.body.style.overflow = "";
  }

  function opportunityForm() {
    if (!state.user || !["owner", "manager"].includes(state.user.role)) {
      notify("Manager access is needed to capture an opportunity.", true);
      return;
    }
    showModal('<span class="eyebrow">CAPTURE A VERIFIED TENDER</span><h2 id="modalTitle">Add an opportunity</h2><p class="modal-intro">Start with the buyer’s official notice. Only capture what you can verify.</p>' +
      '<form id="opportunityForm"><div class="form-field"><label for="newTitle">OPPORTUNITY TITLE *</label><input id="newTitle" name="title" class="field" required maxlength="240"></div>' +
      '<div class="form-two"><div class="form-field"><label for="newFunder">BUYER / FUNDER *</label><input id="newFunder" name="funder" class="field" required maxlength="190"></div>' +
      '<div class="form-field"><label for="newFunderType">BUYER TYPE</label><select id="newFunderType" name="funder_type" class="select"><option value="">Select type</option><option>UN agency</option><option>Development bank</option><option>NGO / INGO</option><option>Government</option><option>Corporate</option><option>Foundation</option></select></div></div>' +
      '<div class="form-two"><div class="form-field"><label for="newSector">SECTOR</label><input id="newSector" name="sector" class="field" maxlength="100" placeholder="e.g. Education"></div>' +
      '<div class="form-field"><label for="newCountry">COUNTRY / MARKET</label><input id="newCountry" name="country" class="field" maxlength="100"></div></div>' +
      '<div class="form-two"><div class="form-field"><label for="newValue">INDICATIVE VALUE</label><input id="newValue" name="value" class="field" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="form-field"><label for="newCurrency">CURRENCY</label><input id="newCurrency" name="currency" class="field" maxlength="3" value="USD"></div></div>' +
      '<div class="form-two"><div class="form-field"><label for="newDeadline">SUBMISSION DEADLINE</label><input id="newDeadline" name="deadline" class="field" type="date"></div>' +
      '<div class="form-field"><label for="newOwner">BID OWNER</label><input id="newOwner" name="owner" class="field" maxlength="120" value="' + escapeHtml(state.user.display_name || "") + '"></div></div>' +
      '<div class="form-two"><div class="form-field"><label for="newSourceName">SOURCE NAME</label><input id="newSourceName" name="source_name" class="field" maxlength="120" placeholder="Buyer portal / source"></div>' +
      '<div class="form-field"><label for="newSourceUrl">OFFICIAL NOTICE URL</label><input id="newSourceUrl" name="source_url" class="field" type="url" maxlength="1000" placeholder="https://…"></div></div>' +
      '<div class="form-field"><label for="newRequirements">SCOPE + MANDATORY CRITERIA</label><textarea id="newRequirements" name="requirements" class="textarea" maxlength="30000" placeholder="Paste or summarise the verified scope, eligibility, mandatory documents and evaluation requirements."></textarea></div>' +
      '<div class="form-error" id="opportunityError"></div><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save opportunity →</button></div></form>');
  }

  function opportunityDetail(id) {
    var item = opportunityById(id);
    if (!item) return;
    state.activeOpportunity = String(id);
    var fit = item.fit_json || {};
    var review = Array.isArray(fit.review) ? fit.review : [];
    var matchDimensions = Array.isArray(fit.dimensions) ? fit.dimensions.map(function (dimension) {
      return dimension.label + ": " + dimension.matched + "/" + dimension.total + " matched";
    }).join(" · ") : "";
    var canManage = state.user && ["owner", "manager"].includes(state.user.role);
    var stageSelect = stageList.map(function (stage) {
      return '<option value="' + stage[0] + '"' + (item.stage === stage[0] ? " selected" : "") + ">" + escapeHtml(stage[1]) + "</option>";
    }).join("");
    var controls = canManage ? '<div class="form-field"><label for="detailStage">PIPELINE STAGE</label><select id="detailStage" class="select" data-stage-change="' +
      escapeHtml(item.id) + '">' + stageSelect + '</select></div><div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap">' +
      '<button class="button button-primary" data-action="use-proposal" data-id="' + escapeHtml(item.id) + '">Open proposal studio</button>' +
      '<button class="button" data-action="use-interview" data-id="' + escapeHtml(item.id) + '">Interview prep</button>' +
      (item.stage === "Won" ? '<button class="button" data-action="create-project" data-id="' + escapeHtml(item.id) + '">Create launch plan</button>' : "") + "</div>" : "";
    showModal('<span class="eyebrow">OPPORTUNITY · ' + escapeHtml(item.currency) + "</span><h2 id=\"modalTitle\">" + escapeHtml(item.title) +
      '</h2><p class="modal-intro">' + escapeHtml(item.funder) + " · " + escapeHtml(item.country || "Market to confirm") + "</p>" +
      '<dl class="details-list"><dt>Pipeline stage</dt><dd>' + stagePill(item.stage) + '</dd><dt>Deadline</dt><dd>' +
      dateLabel(item.deadline) + '</dd><dt>Indicative value</dt><dd>' + money(item.value, item.currency) + '</dd><dt>Bid owner</dt><dd>' +
      escapeHtml(item.owner || "Unassigned") + '</dd><dt>Sector</dt><dd>' + escapeHtml(item.sector || "Not set") +
      '</dd><dt>Source</dt><dd>' + (item.source_url ? '<a href="' + escapeHtml(item.source_url) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(item.source_name || item.source_url) + ' ↗</a>' : escapeHtml(item.source_name || "Not recorded")) +
      '</dd><dt>Requirements</dt><dd>' + escapeHtml(item.requirements || "No scope captured yet.") + '</dd><dt>Fit signal</dt><dd>' +
      Number(item.fit_score || 0) + "% profile match · " + escapeHtml(fit.basis || "Profile alignment only") +
      (matchDimensions ? " (" + escapeHtml(matchDimensions) + ")" : "") + '</dd><dt>Why it matches</dt><dd>' +
      escapeHtml((fit.matched || []).join(", ") || "No profile criteria matched in the captured notice text.") + '</dd><dt>Review flags</dt><dd>' +
      escapeHtml(review.join(" ") || "Manually check the full notice and eligibility requirements.") +
      '</dd><dt>Notes</dt><dd>' + escapeHtml(item.notes || "No notes yet.") + "</dd></dl>" + controls);
  }

  function updateOpportunity(id, patch) {
    return request("opportunity", { method: "PATCH", id: id, body: patch }).then(function (data) {
      var index = state.opportunities.findIndex(function (item) { return String(item.id) === String(id); });
      if (index >= 0) state.opportunities[index] = data.opportunity;
      render();
      return data.opportunity;
    });
  }

  function proposalAction(id) {
    if (!id) return;
    state.activeProposal = String(id);
    state.proposalSections = [];
    request("proposal", { method: "GET", id: id }).then(function (data) {
      if (data.proposal) {
        state.proposalSections = data.proposal.sections_json || [];
        state.proposals = state.proposals.filter(function (item) { return String(item.opportunity_id) !== String(id); });
        state.proposals.push({
          opportunity_id: String(id),
          status: data.proposal.status,
          updated_at: data.proposal.updated_at,
          opportunity_title: data.proposal.opportunity_title,
        });
      }
      setTab("proposal");
    }).catch(function (error) { notify(error.message, true); });
  }

  function generateProposal(button) {
    if (!state.activeProposal) {
      notify("Choose an opportunity first.", true);
      return;
    }
    setBusy(button, true, "Building tailored draft…");
    request("proposal", { method: "POST", id: state.activeProposal, body: {} }).then(function (data) {
      state.proposalSections = data.sections || [];
      var item = opportunityById(state.activeProposal);
      state.proposals = state.proposals.filter(function (proposal) { return String(proposal.opportunity_id) !== String(state.activeProposal); });
      state.proposals.push({ opportunity_id: state.activeProposal, status: "Draft", opportunity_title: item ? item.title : "" });
      render();
      notify(data.draft_mode === "ai"
        ? "AI proposal draft created. Verify every claim and replace evidence prompts."
        : "No-cost structured draft created and saved. Replace evidence prompts and complete the compliance checks.");
    }).catch(function (error) {
      notify(error.message, true);
      setBusy(button, false);
    });
  }

  function saveProposal(button) {
    if (!state.activeProposal || !state.proposalSections || !state.proposalSections.length) return;
    var sections = Array.from(document.querySelectorAll("[data-proposal-section]")).map(function (element) {
      return { title: state.proposalSections[Number(element.dataset.proposalSection)].title, text: element.value };
    });
    setBusy(button, true, "Saving…");
    request("proposal", { method: "POST", id: state.activeProposal, body: { sections: sections } }).then(function (data) {
      state.proposalSections = data.sections || sections;
      state.proposals = state.proposals.filter(function (proposal) { return String(proposal.opportunity_id) !== String(state.activeProposal); });
      var item = opportunityById(state.activeProposal);
      state.proposals.push({ opportunity_id: state.activeProposal, status: "Draft", opportunity_title: item ? item.title : "" });
      render();
      notify("Proposal draft saved securely.");
    }).catch(function (error) {
      notify(error.message, true);
      setBusy(button, false);
    });
  }

  function prepareInterview(id) {
    if (!id) return;
    state.activeOpportunity = String(id);
    request("proposal", { method: "GET", id: id }).then(function (data) {
      if (data.proposal && data.proposal.interview_json) {
        state.interviewQuestions = data.proposal.interview_json;
        setTab("interview");
        return;
      }
      return request("interview", { method: "POST", id: id, body: {} }).then(function (result) {
        state.interviewQuestions = result.questions || [];
        setTab("interview");
        notify("Interview practice pack ready.");
      });
    }).catch(function (error) { notify(error.message, true); });
  }

  function createProject(id) {
    var item = opportunityById(id);
    if (!item) return;
    showModal('<span class="eyebrow">AWARD CONFIRMED · MOBILISE WITH INTENT</span><h2 id="modalTitle">Create launch plan</h2>' +
      '<p class="modal-intro">' + escapeHtml(item.title) + " · " + escapeHtml(item.funder) + "</p>" +
      '<form id="projectForm" data-id="' + escapeHtml(item.id) + '"><div class="form-field"><label for="projectManager">PROJECT MANAGER</label><input id="projectManager" name="project_manager" class="field" maxlength="120" value="' +
      escapeHtml(state.user.display_name || "") + '"></div><div class="form-field"><label for="projectStart">PLANNED START DATE</label><input id="projectStart" name="start_date" class="field" type="date"></div>' +
      '<div class="callout"><strong>Launch controls included:</strong> mobilisation, acceptance baseline, delivery risk, pilot readiness, handover and a 30-day outcomes review. Dates and client owners remain for your team to confirm.</div>' +
      '<div class="modal-actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Create launch plan →</button></div></form>');
  }

  function linesFrom(id) {
    return document.getElementById(id).value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
  }

  function saveProfile(button) {
    var onboarding = !state.profile || state.profile.onboarding_complete !== true;
    var url = document.getElementById("profileWebsite").value.trim();
    if (url && !/^https:\/\/[^ ]+$/i.test(url)) {
      notify("Use a full HTTPS URL for the company website.", true);
      return;
    }
    setBusy(button, true, "Saving…");
    request("profile", {
      method: "PUT",
      body: {
        legal_name: document.getElementById("profileName").value,
        website: url,
        pitch: document.getElementById("profilePitch").value,
        capabilities: linesFrom("profileCapabilities"),
        operating_countries: linesFrom("profileCountries"),
        preferred_countries: linesFrom("profilePreferredCountries"),
        preferred_sectors: linesFrom("profileSectors"),
        preferred_keywords: linesFrom("profileKeywords"),
        preferred_buyer_types: linesFrom("profileBuyerTypes"),
        case_studies: linesFrom("profileCases"),
        certifications: linesFrom("profileCerts"),
      },
    }).then(function (data) {
      state.profile = data.profile;
      if (onboarding) state.tab = "dashboard";
      notify("Company profile saved. Opportunity matches now use your preferences.");
      render();
    }).catch(function (error) {
      var formError = document.getElementById("profileFormError");
      if (formError) formError.textContent = error.message;
      notify(error.message, true);
      setBusy(button, false);
    });
  }

  function exportProposal() {
    var item = opportunityById(state.activeProposal);
    var sections = Array.from(document.querySelectorAll("[data-proposal-section]")).map(function (element) {
      return {
        title: state.proposalSections[Number(element.dataset.proposalSection)].title,
        text: element.value,
      };
    });
    if (!item || !sections.length) return;
    var content = item.title + "\nPrepared for " + item.funder + "\nPrepared by " +
      (state.profile.legal_name || "Your company") + "\n\n" +
      sections.map(function (section) { return section.title.toUpperCase() + "\n\n" + section.text; }).join("\n\n" + "-".repeat(48) + "\n\n");
    downloadText("nexa-bid-proposal-" + item.id + ".txt", content, "text/plain;charset=utf-8");
  }

  function exportCsv() {
    var header = ["Title", "Buyer", "Sector", "Country", "Value", "Currency", "Deadline", "Stage", "Fit signal", "Owner", "Source", "Source URL"];
    function cell(value) {
      var text = String(value == null ? "" : value);
      if (/^[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    var rows = [header].concat(state.opportunities.map(function (item) {
      return [item.title, item.funder, item.sector, item.country, item.value, item.currency, item.deadline, item.stage, item.fit_score, item.owner, item.source_name, item.source_url];
    }));
    downloadText("nexa-bid-pipeline.csv", rows.map(function (row) { return row.map(cell).join(","); }).join("\r\n"), "text/csv;charset=utf-8");
  }

  function exportWorkspaceBackup(button) {
    setBusy(button, true, "Preparing backup…");
    request("export").then(function (backup) {
      var blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      var anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = "nexa-bidops-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(function () { URL.revokeObjectURL(anchor.href); anchor.remove(); }, 500);
      notify("Workspace backup downloaded to this device. Store it securely.");
    }).catch(function (error) {
      notify(error.message, true);
    }).finally(function () {
      setBusy(button, false);
    });
  }

  function downloadText(filename, content, mime) {
    var blob = new Blob(["\ufeff", content], { type: mime });
    var anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(function () { URL.revokeObjectURL(anchor.href); anchor.remove(); }, 500);
  }

  function logout() {
    request("logout", { method: "POST", body: {} }).then(function (data) {
      state.csrf = data.csrf || "";
      window.sessionStorage.removeItem("afc_access_token");
      window.sessionStorage.removeItem("afc_refresh_token");
      showSignIn("");
    }).catch(function (error) { notify(error.message, true); });
  }

  function updateStaff(id, patch) {
    return request("user", { method: "PATCH", id: id, body: patch }).then(function (data) {
      var index = state.users.findIndex(function (member) { return member.user_id === String(id); });
      if (index >= 0) state.users[index] = data.user;
      render();
      notify("Staff account access updated.");
    });
  }

  document.addEventListener("click", function (event) {
    var resendConfirmation = event.target.closest("[data-action='resend-confirmation']");
    if (resendConfirmation) {
      var confirmationEmail = document.getElementById("username");
      var confirmationMessage = document.getElementById("loginError");
      confirmationMessage.textContent = "";
      setBusy(resendConfirmation, true, "Sending…");
      request("resend-confirmation", {
        method: "POST",
        body: { email: confirmationEmail.value.trim() || window.localStorage.getItem("afc_pending_signup_email") || "" },
      }).then(function (result) {
        confirmationMessage.textContent = result.message;
      }).catch(function (error) {
        confirmationMessage.textContent = error.message;
      }).finally(function () { setBusy(resendConfirmation, false); });
      return;
    }
    var authSwitch = event.target.closest("[data-auth-view]");
    if (authSwitch) {
      authView(authSwitch.dataset.authView);
      return;
    }
    var checkout = event.target.closest("[data-checkout]");
    if (checkout) {
      startCheckout(checkout.dataset.checkout, checkout.dataset.plan, checkout);
      return;
    }
    var trialButton = event.target.closest(".plan-trial");
    if (trialButton) {
      startPlanTrial(trialButton.dataset.plan, trialButton);
      return;
    }
    var nav = event.target.closest("[data-nav]");
    if (nav) {
      setTab(nav.dataset.nav);
      return;
    }
    var open = event.target.closest("[data-open-opportunity]");
    if (open) {
      opportunityDetail(open.dataset.openOpportunity);
      return;
    }
    var action = event.target.closest("[data-action]");
    if (!action) return;
    var name = action.dataset.action;
    if (name === "new-opportunity") opportunityForm();
    else if (name === "log-activity") activityForm();
    else if (name === "support") supportForm();
    else if (name === "manage-plan") openPlanScreen("");
    else if (name === "close-modal") closeModal();
    else if (name === "logout") logout();
    else if (name === "open-menu") {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("scrim").classList.add("open");
    } else if (name === "close-menu") {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("scrim").classList.remove("open");
    } else if (name === "generate-proposal") generateProposal(action);
    else if (name === "save-proposal") saveProposal(action);
    else if (name === "download-proposal") exportProposal();
    else if (name === "use-proposal") {
      closeModal();
      proposalAction(action.dataset.id);
    } else if (name === "use-interview" || name === "prepare-interview") {
      closeModal();
      prepareInterview(action.dataset.id || state.activeProposal);
    } else if (name === "generate-interview") prepareInterview(state.activeOpportunity);
    else if (name === "create-project") createProject(action.dataset.id);
    else if (name === "save-profile") saveProfile(action);
    else if (name === "review-learning") {
      request("learning", { method: "PATCH", id: action.dataset.id, body: { status: action.dataset.status } })
        .then(function (result) {
          var index = state.learnings.findIndex(function (item) { return String(item.id) === String(result.learning.id); });
          if (index >= 0) state.learnings[index] = result.learning;
          renderLearnings();
          notify(result.learning.status === "reviewed" ? "Learning approved for reuse." : "Learning draft archived.");
        }).catch(function (error) { notify(error.message, true); });
    }
    else if (name === "export-csv") exportCsv();
    else if (name === "export-backup") exportWorkspaceBackup(action);
    else if (name === "print-report") window.print();
    else if (name === "toggle-user") {
      updateStaff(action.dataset.id, { active: action.dataset.active === "true" }).catch(function (error) { notify(error.message, true); });
    }
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id === "signupForm") {
      event.preventDefault();
      var signupForm = event.target;
      var signupButton = signupForm.querySelector('button[type="submit"]');
      var signupPayload = Object.fromEntries(new FormData(signupForm).entries());
      signupPayload.marketing_consent = signupPayload.marketing_consent === "true";
      document.getElementById("signupError").textContent = "";
      window.localStorage.setItem("afc_pending_signup_email", signupPayload.email);
      setBusy(signupButton, true, "Creating secure workspace…");
      request("signup", { method: "POST", body: signupPayload }).then(function (result) {
        state.user = result.user;
        state.subscription = result.subscription;
        if (result.access_token) window.sessionStorage.setItem("afc_access_token", result.access_token);
        if (result.refresh_token) window.sessionStorage.setItem("afc_refresh_token", result.refresh_token);
        if (result.email_confirmation_required) {
          window.sessionStorage.setItem("afc_pending_plan_selection", "true");
          showSignIn("Account created. Confirm your email using the link we sent, then sign in to choose a trial or paid plan.");
          document.getElementById("username").value = signupPayload.email;
          document.getElementById("confirmationActions").hidden = false;
          return;
        }
        window.localStorage.removeItem("afc_pending_signup_email");
        openPlanScreen("Your seven-day trial has started. Choose a package to continue, or subscribe now.");
      }).catch(function (error) {
        document.getElementById("signupError").textContent = error.message;
      }).finally(function () { setBusy(signupButton, false); });
    } else if (event.target.id === "supportForm") {
      event.preventDefault();
      var supportFormElement = event.target;
      var supportButton = supportFormElement.querySelector('button[type="submit"]');
      var supportPayload = Object.fromEntries(new FormData(supportFormElement).entries());
      supportPayload.marketing_consent = supportPayload.marketing_consent === "true";
      var supportError = document.getElementById("supportError");
      supportError.textContent = "";
      setBusy(supportButton, true, "Sending securely…");
      request("support", { method: "POST", body: supportPayload }).then(function (result) {
        closeModal();
        notify(result.message || "Your support request was sent.");
      }).catch(function (error) {
        supportError.textContent = error.message + " Please try again.";
        setBusy(supportButton, false);
      });
    } else if (event.target.id === "learningForm") {
      event.preventDefault();
      var learningForm = event.target;
      var learningButton = learningForm.querySelector('button[type="submit"]');
      var learningPayload = Object.fromEntries(new FormData(learningForm).entries());
      var learningError = document.getElementById("learningFormError");
      learningError.textContent = "";
      setBusy(learningButton, true, "Creating draft…");
      request("learning", { method: "POST", body: learningPayload }).then(function (result) {
        state.learnings.unshift(result.learning);
        learningForm.reset();
        renderLearnings();
        notify("Learning draft saved. Review its evidence before approval.");
      }).catch(function (error) {
        learningError.textContent = error.message;
        setBusy(learningButton, false);
      });
    } else if (event.target.id === "activityForm") {
      event.preventDefault();
      var activityFormElement = event.target;
      var activityButton = activityFormElement.querySelector('button[type="submit"]');
      var activityPayload = Object.fromEntries(new FormData(activityFormElement).entries());
      var activityError = document.getElementById("activityFormError");
      activityError.textContent = "";
      setBusy(activityButton, true, "Saving activity…");
      request("activity", { method: "POST", body: activityPayload }).then(function (result) {
        state.activity.unshift(result.activity);
        closeModal();
        render();
        notify("Activity added to the workspace timeline.");
      }).catch(function (failure) {
        activityError.textContent = failure.message;
        setBusy(activityButton, false);
      });
    } else if (event.target.id === "companyProfileForm") {
      event.preventDefault();
      saveProfile(event.target.querySelector('button[type="submit"]'));
    } else if (event.target.id === "loginForm") {
      event.preventDefault();
      var form = event.target;
      var error = document.getElementById("loginError");
      error.textContent = "";
      var button = form.querySelector('button[type="submit"]');
      var username = form.elements.namedItem("username");
      var password = form.elements.namedItem("password");
      setBusy(button, true, "Signing in…");
      request("login", {
        method: "POST",
        body: { username: username.value.trim(), password: password.value },
      }).then(function (data) {
        state.csrf = data.csrf;
        state.user = data.user;
        if (data.access_token) window.sessionStorage.setItem("afc_access_token", data.access_token);
        if (data.refresh_token) window.sessionStorage.setItem("afc_refresh_token", data.refresh_token);
        document.getElementById("confirmationActions").hidden = true;
        return loadWorkspace().then(function () {
          if (!resumePendingPlanSelection()) handleBillingReturn();
        });
      }).catch(function (failure) {
        error.textContent = failure.message;
        setBusy(button, false);
      });
    } else if (event.target.id === "opportunityForm") {
      event.preventDefault();
      var form = event.target;
      var button = form.querySelector('button[type="submit"]');
      var payload = Object.fromEntries(new FormData(form).entries());
      payload.value = Number(payload.value || 0);
      setBusy(button, true, "Saving opportunity…");
      request("opportunities", { method: "POST", body: payload }).then(function (data) {
        state.opportunities.unshift(data.opportunity);
        closeModal();
        render();
        notify("Opportunity captured. Verify the buyer's notice and criteria.");
      }).catch(function (failure) {
        var target = document.getElementById("opportunityError");
        if (target) target.textContent = failure.message;
        setBusy(button, false);
      });
    } else if (event.target.id === "projectForm") {
      event.preventDefault();
      var projectForm = event.target;
      var projectButton = projectForm.querySelector('button[type="submit"]');
      var projectPayload = Object.fromEntries(new FormData(projectForm).entries());
      setBusy(projectButton, true, "Creating launch plan…");
      request("project", { method: "POST", id: projectForm.dataset.id, body: projectPayload }).then(function () {
        closeModal();
        return loadWorkspace().then(function () {
          setTab("delivery");
          notify("Project launch plan created. Confirm owners and client dates.");
        });
      }).catch(function (failure) {
        notify(failure.message, true);
        setBusy(projectButton, false);
      });
    } else if (event.target.id === "staffInviteForm") {
      event.preventDefault();
      var inviteForm = event.target;
      var inviteButton = inviteForm.querySelector('button[type="submit"]');
      var invitePayload = Object.fromEntries(new FormData(inviteForm).entries());
      var inviteError = document.getElementById("staffInviteError");
      inviteError.textContent = "";
      setBusy(inviteButton, true, "Sending invitation…");
      request("users", { method: "POST", body: invitePayload }).then(function (data) {
        state.users.push(data.user);
        render();
        notify(data.message || "Invitation sent. The staff member must use the email link to set a password.");
      }).catch(function (failure) {
        inviteError.textContent = failure.message;
        setBusy(inviteButton, false);
      });
    }
  });

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (target.id === "oppStage") {
      state.stage = target.value;
      renderOpportunities();
    } else if (target.id === "oppSector") {
      state.sector = target.value;
      renderOpportunities();
    } else if (target.id === "sourceCapability") {
      state.sourceCapability = target.value;
      renderOpportunities();
    } else if (target.id === "sourceMarket") {
      state.sourceMarket = target.value;
      renderOpportunities();
    } else if (target.dataset.userRole) {
      updateStaff(target.dataset.userRole, { role: target.value }).catch(function (error) {
        notify(error.message, true);
        renderTeam();
      });
    } else if (target.id === "proposalSelect") {
      state.activeProposal = target.value ? String(target.value) : null;
      state.proposalSections = [];
      if (state.activeProposal) proposalAction(state.activeProposal);
      else renderProposal();
    } else if (target.id === "interviewSelect") {
      state.activeOpportunity = target.value ? String(target.value) : null;
      state.interviewQuestions = [];
      renderInterview();
    } else if (target.id === "proposalStatus") {
      if (!state.activeProposal) return;
      var proposalId = state.activeProposal;
      request("proposal", { method: "PATCH", id: proposalId, body: { status: target.value } }).then(function (data) {
        var proposal = state.proposals.find(function (item) { return String(item.opportunity_id) === String(proposalId); });
        if (proposal) proposal.status = data.status;
        renderProposal();
        notify("Proposal review status updated.");
      }).catch(function (error) {
        notify(error.message, true);
        renderProposal();
      });
    } else if (target.dataset.stageChange) {
      var id = target.dataset.stageChange;
      updateOpportunity(id, { stage: target.value }).then(function () {
        opportunityDetail(id);
        notify("Pipeline stage updated.");
      }).catch(function (error) { notify(error.message, true); });
    } else if (target.dataset.milestone) {
      var milestoneId = target.dataset.milestone;
      var previous = target.dataset.previous || "Not started";
      request("milestone", { method: "PATCH", id: milestoneId, body: { status: target.value } }).then(function () {
        target.dataset.previous = target.value;
        return loadWorkspace().then(function () { setTab("delivery"); notify("Launch milestone updated."); });
      }).catch(function (error) {
        target.value = previous;
        notify(error.message, true);
      });
    } else if (target.dataset.milestoneDate) {
      var dateMilestoneId = target.dataset.milestoneDate;
      request("milestone", { method: "PATCH", id: dateMilestoneId, body: { due_date: target.value || null } }).then(function () {
        return loadWorkspace().then(function () { setTab("delivery"); notify("Project schedule updated."); });
      }).catch(function (error) {
        notify(error.message, true);
        loadWorkspace().then(function () { setTab("delivery"); });
      });
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "oppSearch") {
      state.search = event.target.value;
      var position = event.target.selectionStart;
      renderOpportunities();
      var search = document.getElementById("oppSearch");
      search.focus();
      search.setSelectionRange(position, position);
    }
  });

  document.getElementById("modal").addEventListener("click", function (event) {
    if (event.target.id === "modal") closeModal();
  });

  var authRedirect = previewMode ? { signupConfirmation: false } : consumeSupabaseAuthRedirect();
  if (previewMode) {
    startPreview().catch(function (error) { notify(error.message, true); });
  } else if (authRedirect.error) {
    showSignIn(authRedirect.error);
    document.getElementById("username").value = window.localStorage.getItem("afc_pending_signup_email") || "";
    document.getElementById("confirmationActions").hidden = false;
  } else {
    request("session").then(function (data) {
      if (data.mode === "preview") {
        previewMode = true;
        return startPreview();
      }
      state.csrf = data.csrf;
      state.user = data.user;
      if (!data.user) {
        showSignIn("");
        return;
      }
      return loadWorkspace().then(function () {
        if (authRedirect.signupConfirmation) document.getElementById("confirmationActions").hidden = true;
        if (!resumePendingPlanSelection()) handleBillingReturn();
      });
    }).catch(function (error) {
      showSignIn("");
      document.getElementById("loginError").textContent = error.message + " Check the Netlify, HTTPS and database configuration.";
    });
  }
}());
