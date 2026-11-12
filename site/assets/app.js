(function () {
  "use strict";

  var API = "api/index.php";
  var previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
  var demo = { nextId: 10, nextMilestone: 1 };
  var state = {
    csrf: "",
    user: null,
    profile: null,
    opportunities: [],
    projects: [],
    proposals: [],
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
  var pageNames = {
    dashboard: "Executive brief",
    opportunities: "Opportunity radar",
    pipeline: "Bid pipeline",
    reports: "Portfolio report",
    proposal: "Proposal studio",
    interview: "Interview room",
    delivery: "Project launch",
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
    var id = options.id || 0;
    var body = options.body || {};
    var item;
    if (route === "login") throw new Error("Use Open interactive preview to enter preview mode.");
    if (route === "bootstrap") {
      return {
        ok: true, mode: "preview", user: state.user, csrf: "",
        profile: clone(state.profile),
        opportunities: clone(state.opportunities),
        projects: clone(state.projects),
        proposals: clone(state.proposals),
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
        workspace: "AfroCloud BidOps preview",
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
    if (route === "profile" && method === "PUT") {
      state.profile = Object.assign({}, state.profile, clone(body));
      state.activity.unshift({ action: "update", entity_type: "company_profile", entity_id: 1, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, profile: clone(state.profile) };
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
      state.opportunities.unshift(item);
      state.activity.unshift({ action: "create", entity_type: "opportunity", entity_id: item.id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, opportunity: clone(item) };
    }
    if (route === "opportunity" && method === "PATCH") {
      item = opportunityById(id);
      if (!item) throw new Error("Opportunity not found.");
      Object.assign(item, clone(body));
      state.activity.unshift({ action: "update", entity_type: "opportunity", entity_id: item.id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, opportunity: clone(item) };
    }
    if (route === "proposal" && method === "GET") {
      item = state.proposals.find(function (proposal) { return Number(proposal.opportunity_id) === id; });
      return { ok: true, proposal: item ? clone(item) : null };
    }
    if (route === "proposal" && method === "POST") {
      item = opportunityById(id);
      if (!item) throw new Error("Opportunity not found.");
      var existing = state.proposals.find(function (proposal) { return Number(proposal.opportunity_id) === id; });
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
      if (!state.proposals.some(function (proposal) { return Number(proposal.opportunity_id) === id; })) state.proposals.push(existing);
      else if (existing) {
        var index = state.proposals.findIndex(function (proposal) { return Number(proposal.opportunity_id) === id; });
        state.proposals[index] = existing;
      }
      state.activity.unshift({ action: "edit", entity_type: "proposal", entity_id: id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, sections: clone(existing.sections_json) };
    }
    if (route === "proposal" && method === "PATCH") {
      item = state.proposals.find(function (proposal) { return Number(proposal.opportunity_id) === id; });
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
      var savedProposal = state.proposals.find(function (proposal) { return Number(proposal.opportunity_id) === id; });
      if (savedProposal) savedProposal.interview_json = clone(questions);
      state.activity.unshift({ action: "prepare", entity_type: "interview", entity_id: id, display_name: state.user.display_name, created_at: new Date().toISOString() });
      return { ok: true, questions: questions };
    }
    if (route === "project" && method === "POST") {
      item = opportunityById(id);
      if (!item || item.stage !== "Won") throw new Error("Mark an opportunity Won after award confirmation before creating its launch plan.");
      var project = state.projects.find(function (value) { return Number(value.opportunity_id) === id; });
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
        milestone = project.milestones.find(function (value) { return Number(value.id) === id; });
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
    return '<span class="fit-line">Screening signal <span class="fit-bar"><i style="width:' + value + '%"></i></span><b>' + value + "</b></span>";
  }

  function opportunityById(id) {
    return state.opportunities.find(function (item) { return Number(item.id) === Number(id); });
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
    return '<button class="row-action" data-open-opportunity="' + Number(id) + '">Open →</button>';
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
        ? "The latest daily scan found no eligible new notices."
        : "Daily AI discovery will appear here after the scheduled scan is configured and completed.", '<button class="button button-small" data-nav="opportunities">Review sources</button>');
    var discoveryStatus = state.latestDiscovery
      ? "Last scan " + new Date(state.latestDiscovery.started_at).toLocaleString() + " · " +
        (state.latestDiscovery.status === "completed" ? Number(state.latestDiscovery.added_count || 0) + " added" : state.latestDiscovery.status)
      : "Daily source scan not run yet";
    var topAction = state.user && (state.user.role === "owner" || state.user.role === "manager")
      ? '<button class="button button-primary" data-action="new-opportunity">＋ Capture opportunity</button>' : "";

    document.getElementById("view-dashboard").innerHTML =
      pageHead("CEO / PROJECT MANAGER · COMMAND VIEW", "A clearer path from signal to impact.", "Your bid portfolio, the next decision and launch readiness — in one private workspace.", topAction) +
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
      signalContent + '</div><p class="panel-sub">AI-screened leads are not verified eligibility decisions. Check the original notice before committing bid effort.</p></div></article>' +
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
    var terms = "(" + group.terms.join(" OR ") + ")";
    var adjacent = source.kind === "Employment listings" || source.kind === "Context / jobs";
    var query = (engine || source.domain === "google.com" || source.domain === "bing.com" ? "" : "site:" + source.domain + " ") +
      terms + " (" + market.terms + ")" + (adjacent ? "" : " " + tenderTerms + " " + exclusions);
    var base = engine === "bing" || source.domain === "bing.com" ? "https://www.bing.com/search?q=" : "https://www.google.com/search?q=";
    return base + encodeURIComponent(query);
  }

  function sourceCards() {
    var group = sourceKeywordGroups[state.sourceCapability] || sourceKeywordGroups.learning;
    var market = sourceMarkets[state.sourceMarket] || sourceMarkets.east;
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
      '<div class="keyword-list"><b>KEYWORDS INCLUDED</b>' + group.terms.map(function (term) {
        return '<span class="keyword-chip">' + escapeHtml(term) + "</span>";
      }).join("") + '</div><div class="callout source-query"><strong>Search recipe:</strong> ' + escapeHtml(group.label) + " + " + escapeHtml(market.label) +
      ' + RFP / tender / procurement / EOI / consultancy. Poor-fit exclusions: civil/building works, vehicles, catering, office supplies, computer/tablet-only supply and printing. <b>When configured, a scheduled Claude web-search scan checks permitted source domains daily and AI screens candidates. It is not a Google API feed; search coverage can be incomplete, and every notice must be verified.</b></div>' +
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
      '<div class="callout"><strong>Signal quality matters.</strong> Opportunities can be entered by your team or suggested by the scheduled AI search. AI screening is not an eligibility decision and does not guarantee complete or current coverage. Verify every notice and mandatory criterion with the buyer.</div>' +
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
          return '<article class="pipeline-card" data-open-opportunity="' + Number(item.id) + '"><b>' + escapeHtml(item.title) +
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
    var activity = (state.activity || []).length ? state.activity.map(function (item) {
      var labels = {
        opportunity: "Opportunity",
        discovery: "Tender discovery",
        proposal: "Proposal",
        interview: "Interview preparation",
        project: "Project launch",
        milestone: "Delivery update",
        company_profile: "Company evidence",
        user: "Workspace access",
      };
      return '<div class="opp-row"><div><div class="opp-name">' + escapeHtml(labels[item.entity_type] || item.entity_type) +
        " · " + escapeHtml(item.action.replace(/_/g, " ")) + '</div><div class="opp-meta">' +
        escapeHtml(item.display_name || "Workspace user") + " · " + dateLabel(String(item.created_at || "").slice(0, 10)) +
        '</div></div><div class="opp-right"><span class="pill">' + escapeHtml(item.entity_id ? "#" + item.entity_id : "System") + "</span></div></div>";
    }).join("") : emptyState("No activity to report yet", "Important changes will appear here as your team qualifies bids, saves drafts and updates delivery.");
    var rows = state.opportunities.length ? state.opportunities.slice().sort(function (a, b) {
      return String(a.deadline || "9999").localeCompare(String(b.deadline || "9999"));
    }).map(function (item) {
      return "<tr><td><b>" + escapeHtml(item.title) + '</b><div class="opp-meta">' + escapeHtml(item.funder) +
        "</div></td><td>" + escapeHtml(stageLabel(item.stage)) + "</td><td>" + dateLabel(item.deadline) + "</td><td>" +
        money(item.value, item.currency) + "</td><td>" + Number(item.fit_score || 0) + "</td></tr>";
    }).join("") : '<tr><td colspan="5">' + emptyState("No portfolio records yet", "Report data is calculated from your real opportunities only.") + "</td></tr>";
    document.getElementById("view-reports").innerHTML =
      pageHead("PORTFOLIO · EVIDENCE · MOMENTUM", "Portfolio report", "A clean management snapshot of real bid records and the latest team updates.",
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
      rows + "</tbody></table></div></article><article class=\"panel\"><div class=\"panel-head\"><div><h2 class=\"panel-title\">Latest team updates</h2><p class=\"panel-sub\">Recent audited actions in this workspace</p></div></div>" +
      '<div class="opportunity-list">' + activity + "</div></article></div>";
  }

  function renderProposal() {
    var choices = state.opportunities.filter(function (item) { return item.stage !== "Lost" && item.stage !== "NoGo"; });
    var active = state.activeProposal;
    var current = active ? opportunityById(active) : null;
    var generated = state.proposals.find(function (item) { return Number(item.opportunity_id) === Number(active); });
    var sections = state.proposalSections || [];
    var editor = sections.length ? sections.map(function (section, index) {
      return '<div class="proposal-section"><label for="proposal-' + index + '">' + escapeHtml(section.title) +
        '</label><textarea class="textarea" id="proposal-' + index + '" data-proposal-section="' + index + '">' + escapeHtml(section.text) + "</textarea></div>";
    }).join("") : emptyState("Build a structured draft", "Select an opportunity to generate an editable response outline. It will use the actual scope you capture and will flag where verified evidence is missing.");

    document.getElementById("view-proposal").innerHTML =
      pageHead("RESPOND · PROVE · REFINE", "Proposal studio", "A disciplined first draft — never a substitute for the buyer's exact RFP or verified evidence.",
        '<button class="button" data-action="download-proposal"' + (sections.length ? "" : " disabled") + ">↓ Export text</button>" +
        '<button class="button button-primary" data-action="save-proposal"' + (sections.length ? "" : " disabled") + ">Save draft</button>") +
      '<div class="callout"><strong>Truth-before-polish.</strong> ' + (previewMode
        ? "The interactive preview uses a built-in outline. In the live workspace, Claude drafts from the captured notice and company evidence; it does not guarantee awards."
        : "Claude drafts a tailored proposal from the captured notice and company evidence; it does not guarantee awards.") +
        ' Verify every claim, replace any evidence gaps, validate costs and have a human bid lead approve the final submission.</div>' +
      '<div class="proposal-layout"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Technical response</h2><p class="panel-sub">' +
      (current ? escapeHtml(current.title) + " · " + escapeHtml(current.funder) : "Select a real opportunity to start") +
      '</p></div><button class="button button-small button-primary" data-action="generate-proposal"' + (current ? "" : " disabled") +
      ">" + (previewMode ? "Generate outline" : "Generate AI draft") + "</button></div>" +
      '<div class="panel-pad">' + editor + "</div></article><aside class=\"panel proposal-sidebar\"><div class=\"panel-head\"><div><h2 class=\"panel-title\">Bid readiness</h2><p class=\"panel-sub\">A practical review, not a compliance verdict</p></div></div>" +
      '<div class="panel-body"><select id="proposalSelect" class="select"><option value="">Choose opportunity</option>' + choices.map(function (item) {
        return '<option value="' + Number(item.id) + '"' + (Number(active) === Number(item.id) ? " selected" : "") + ">" + escapeHtml(item.title) + "</option>";
      }).join("") + "</select>" + (current ? '<div class="score-ring" style="--score:' + Number(current.fit_score || 0) + '%"><b>' +
        Number(current.fit_score || 0) + "</b></div><div style=\"text-align:center;font-size:9px;color:#8591a4;margin-top:-5px\">Capability screening signal</div>" +
        '<div class="signal-card"><span class="signal-label"><i></i> WHAT TO VERIFY</span><p style="margin-top:7px">' +
        escapeHtml((current.fit_json && current.fit_json.basis) || "Keyword screening only.") + "</p></div>" +
        '<button class="button button-wide" data-action="prepare-interview" data-id="' + Number(current.id) + '">Prepare interview →</button>' : "") +
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
        return '<option value="' + Number(item.id) + '"' + (Number(active) === Number(item.id) ? " selected" : "") + ">" + escapeHtml(item.title) + "</option>";
      }).join("") + '</select></div><div class="panel-pad">' + list + "</div></article>";
  }

  function renderDelivery() {
    var projects = state.projects || [];
    var content = projects.length ? projects.map(function (project) {
      var complete = project.milestones.filter(function (item) { return item.status === "Done"; }).length;
      var pct = project.milestones.length ? Math.round(complete / project.milestones.length * 100) : 0;
      return '<article class="panel project-card"><div class="project-top"><div><h3>' + escapeHtml(project.opportunity_title) +
        '</h3><p>' + escapeHtml(project.funder) + " · " + escapeHtml(project.project_manager || "Project manager to assign") + " · " +
        dateLabel(project.start_date) + '</p></div><div style="text-align:right">' + money(project.value, project.currency) +
        '<div class="fit-line" style="justify-content:flex-end">' + pct + "% launch controls complete</div></div></div>" +
        '<div class="milestone-list">' + project.milestones.map(function (milestone) {
          return '<div class="milestone-row"><div><b>' + escapeHtml(milestone.title) + '</b><small>' +
            (milestone.due_date ? dateLabel(milestone.due_date) : "Assign an owner and date during mobilisation") + '</small></div>' +
            '<select class="select" data-milestone="' + Number(milestone.id) + '"><option' + (milestone.status === "Not started" ? " selected" : "") +
            ">Not started</option><option" + (milestone.status === "In progress" ? " selected" : "") + ">In progress</option><option" +
            (milestone.status === "At risk" ? " selected" : "") + ">At risk</option><option" + (milestone.status === "Done" ? " selected" : "") +
            ">Done</option></select></div>";
        }).join("") + "</div></article>";
    }).join("") : emptyState("Build the launch, not just the bid", "After award is confirmed, mark the opportunity Won and create a launch plan. It seeds mobilisation, acceptance, risk, pilot, handover and early-outcome checkpoints.");
    document.getElementById("view-delivery").innerHTML =
      pageHead("AWARD → MOBILISE → MEASURE", "Project launch", "Make the hand-off from bid team to delivery team visible, owned and measurable.",
        '<button class="button" data-nav="opportunities">Review won opportunities →</button>') +
      '<div class="callout"><strong>Start at award confirmation.</strong> Launch plans can only be created from an opportunity your authorised manager has marked Won. Add client-agreed dates and owners after the kick-off.</div>' +
      content;
  }

  function renderProfile() {
    var profile = state.profile || {};
    function lines(key) { return Array.isArray(profile[key]) ? profile[key].join("\n") : ""; }
    document.getElementById("view-profile").innerHTML =
      pageHead("CAPABILITY · CREDENTIALS · PROOF", "Company evidence", "Keep the claims behind every bid current, specific and supportable.",
        state.user && (state.user.role === "owner" || state.user.role === "manager") ? '<button class="button button-primary" data-action="save-profile">Save company profile</button>' : "") +
      '<div class="warning-note"><b>!</b><div><strong>Verify before external use.</strong> The starting capability profile comes from the attached prototype and has not been independently verified. Confirm company metrics, office locations, references and credentials before external use. Add evidence your team can actually submit.</div></div>' +
      '<div class="profile-grid"><article class="panel panel-pad"><h2 class="panel-title" style="margin-bottom:15px">Positioning and capability</h2>' +
      '<div class="profile-field"><label for="profileName">LEGAL / TRADING NAME</label><input id="profileName" class="field" maxlength="160" value="' + escapeHtml(profile.legal_name || "") + '"></div>' +
      '<div class="profile-field"><label for="profileWebsite">VERIFIED WEBSITE</label><input id="profileWebsite" class="field" maxlength="240" placeholder="https://…" value="' + escapeHtml(profile.website || "") + '"></div>' +
      '<div class="profile-field"><label for="profilePitch">COMPANY SUMMARY</label><textarea id="profilePitch" class="textarea" maxlength="1200">' + escapeHtml(profile.pitch || "") + '</textarea></div>' +
      '<div class="profile-field"><label for="profileCountries">VERIFIED OPERATING MARKETS · ONE PER LINE</label><textarea id="profileCountries" class="textarea" placeholder="Country / market · verify before external use">' +
      escapeHtml(lines("operating_countries")) + "</textarea></div>" +
      '<div class="profile-field"><label for="profileCapabilities">CAPABILITIES · ONE PER LINE</label><textarea id="profileCapabilities" class="textarea" style="min-height:130px">' +
      escapeHtml(lines("capabilities")) + "</textarea></div></article>" +
      '<article class="panel panel-pad"><h2 class="panel-title" style="margin-bottom:5px">Proof that earns trust</h2><p class="panel-sub" style="margin-bottom:17px">Use only approved, traceable evidence. One item per line.</p>' +
      '<div class="profile-field"><label for="profileCases">VERIFIED CASE STUDIES / OUTCOMES</label><textarea id="profileCases" class="textarea" style="min-height:120px" placeholder="Client-approved reference · scope · date · measured outcome">' +
      escapeHtml(lines("case_studies")) + '</textarea></div>' +
      '<div class="profile-field"><label for="profileCerts">CERTIFICATIONS / REGISTRATIONS</label><textarea id="profileCerts" class="textarea" style="min-height:85px" placeholder="Certificate / registration · issuer · expiry">' +
      escapeHtml(lines("certifications")) + "</textarea></div>" +
      '<div class="signal-card"><span class="signal-label"><i></i> EVIDENCE RULE</span><h3>Claim → owner → source → approval</h3><p>Maintain that chain for each credential, metric, client reference, CV and financial figure used in a submission.</p></div>' +
      '<p class="panel-sub">' + escapeHtml(profile.positioning_note || "Verify every claim before external use.") + "</p></article></div>";
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
        "</span><div><b>" + escapeHtml(member.display_name || "AfroCloud team member") + '</b><div class="opp-meta">' + escapeHtml(member.email || "Email not recorded") +
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
    document.getElementById("navOppCount").textContent = String(state.opportunities.length);
    renderDashboard();
    renderOpportunities();
    renderPipeline();
    renderReports();
    renderProposal();
    renderInterview();
    renderDelivery();
    renderProfile();
    renderTeam();
    document.querySelectorAll(".view").forEach(function (element) {
      element.classList.toggle("active", element.id === "view-" + state.tab);
    });
    document.querySelectorAll(".nav-item").forEach(function (element) {
      element.classList.toggle("active", element.dataset.nav === state.tab);
    });
    document.getElementById("crumb").textContent = pageNames[state.tab] || pageNames.dashboard;
    document.getElementById("userName").textContent = state.user.display_name || state.user.username;
    document.getElementById("userRole").textContent = state.user.role;
    document.getElementById("userAvatar").textContent = (state.user.display_name || state.user.username || "A").slice(0, 1).toUpperCase();
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
      state.opportunities = data.opportunities || [];
      state.projects = data.projects || [];
      state.proposals = data.proposals || [];
      state.activity = data.activity || [];
      state.latestDiscovery = data.latest_discovery || null;
      document.getElementById("loginScreen").hidden = true;
      document.getElementById("appShell").hidden = false;
      var teamRequest = state.user && ["owner", "manager"].includes(state.user.role)
        ? request("users").then(function (members) { state.users = members.users || []; })
        : Promise.resolve();
      return teamRequest.then(function () { render(); });
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
      legal_name: "AfroCloud Technologies · Preview",
      website: "",
      pitch: "Demonstration profile only. Replace with company-approved positioning.",
      capabilities: ["Digital learning content", "Microlearning and performance support", "Cloud services and cybersecurity", "Programme delivery and PMO"],
      operating_countries: [],
      case_studies: [],
      certifications: [],
      positioning_note: "Preview workspace. No company claims, references or credentials have been verified.",
    };
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
      { action: "updated", entity_type: "milestone", entity_id: 3, display_name: "Grace · Project manager", created_at: new Date().toISOString() },
      { action: "saved_draft", entity_type: "proposal", entity_id: 5, display_name: "Daniel · Proposal lead", created_at: new Date(Date.now() - 86400000).toISOString() },
      { action: "go_no_go_review", entity_type: "opportunity", entity_id: 1, display_name: "Amina · Bid lead", created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { action: "launch_plan", entity_type: "project", entity_id: 3, display_name: "Grace · Project manager", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    ];
    state.users = [
      { user_id: "preview-owner", email: "ceo@example.test", display_name: "AfroCloud CEO", role: "owner", active: true, created_at: new Date().toISOString() },
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

  function signInRequired() {
    state.user = null;
    state.opportunities = [];
    state.users = [];
    document.getElementById("appShell").hidden = true;
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("previewButton").hidden = !previewMode;
  }

  function showSignIn(error) {
    signInRequired();
    document.getElementById("loginError").textContent = error || "";
    var form = document.getElementById("loginForm");
    if (form) form.reset();
    document.getElementById("previewButton").hidden = !previewMode;
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
    state.activeOpportunity = Number(id);
    var fit = item.fit_json || {};
    var review = Array.isArray(fit.review) ? fit.review : [];
    var canManage = state.user && ["owner", "manager"].includes(state.user.role);
    var stageSelect = stageList.map(function (stage) {
      return '<option value="' + stage[0] + '"' + (item.stage === stage[0] ? " selected" : "") + ">" + escapeHtml(stage[1]) + "</option>";
    }).join("");
    var controls = canManage ? '<div class="form-field"><label for="detailStage">PIPELINE STAGE</label><select id="detailStage" class="select" data-stage-change="' +
      Number(item.id) + '">' + stageSelect + '</select></div><div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap">' +
      '<button class="button button-primary" data-action="use-proposal" data-id="' + Number(item.id) + '">Open proposal studio</button>' +
      '<button class="button" data-action="use-interview" data-id="' + Number(item.id) + '">Interview prep</button>' +
      (item.stage === "Won" ? '<button class="button" data-action="create-project" data-id="' + Number(item.id) + '">Create launch plan</button>' : "") + "</div>" : "";
    showModal('<span class="eyebrow">OPPORTUNITY · ' + escapeHtml(item.currency) + "</span><h2 id=\"modalTitle\">" + escapeHtml(item.title) +
      '</h2><p class="modal-intro">' + escapeHtml(item.funder) + " · " + escapeHtml(item.country || "Market to confirm") + "</p>" +
      '<dl class="details-list"><dt>Pipeline stage</dt><dd>' + stagePill(item.stage) + '</dd><dt>Deadline</dt><dd>' +
      dateLabel(item.deadline) + '</dd><dt>Indicative value</dt><dd>' + money(item.value, item.currency) + '</dd><dt>Bid owner</dt><dd>' +
      escapeHtml(item.owner || "Unassigned") + '</dd><dt>Sector</dt><dd>' + escapeHtml(item.sector || "Not set") +
      '</dd><dt>Source</dt><dd>' + (item.source_url ? '<a href="' + escapeHtml(item.source_url) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(item.source_name || item.source_url) + ' ↗</a>' : escapeHtml(item.source_name || "Not recorded")) +
      '</dd><dt>Requirements</dt><dd>' + escapeHtml(item.requirements || "No scope captured yet.") + '</dd><dt>Fit signal</dt><dd>' +
      Number(item.fit_score || 0) + "/100 · " + escapeHtml(fit.basis || "Screening signal only") + '</dd><dt>Matched capabilities</dt><dd>' +
      escapeHtml((fit.matched || []).join(", ") || "No capability keywords matched") + '</dd><dt>Review flags</dt><dd>' +
      escapeHtml(review.join(" ") || "No known flags from basic keyword screening. Manually check the full RFP.") +
      '</dd><dt>Notes</dt><dd>' + escapeHtml(item.notes || "No notes yet.") + "</dd></dl>" + controls);
  }

  function updateOpportunity(id, patch) {
    return request("opportunity", { method: "PATCH", id: id, body: patch }).then(function (data) {
      var index = state.opportunities.findIndex(function (item) { return Number(item.id) === Number(id); });
      if (index >= 0) state.opportunities[index] = data.opportunity;
      render();
      return data.opportunity;
    });
  }

  function proposalAction(id) {
    if (!id) return;
    state.activeProposal = Number(id);
    state.proposalSections = [];
    request("proposal", { method: "GET", id: id }).then(function (data) {
      if (data.proposal) {
        state.proposalSections = data.proposal.sections_json || [];
        state.proposals = state.proposals.filter(function (item) { return Number(item.opportunity_id) !== Number(id); });
        state.proposals.push({
          opportunity_id: Number(id),
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
    setBusy(button, true, "Building outline…");
    request("proposal", { method: "POST", id: state.activeProposal, body: {} }).then(function (data) {
      state.proposalSections = data.sections || [];
      var item = opportunityById(state.activeProposal);
      state.proposals = state.proposals.filter(function (proposal) { return Number(proposal.opportunity_id) !== Number(state.activeProposal); });
      state.proposals.push({ opportunity_id: state.activeProposal, status: "Draft", opportunity_title: item ? item.title : "" });
      render();
      notify("Draft outline created. Replace every evidence prompt.");
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
      state.proposals = state.proposals.filter(function (proposal) { return Number(proposal.opportunity_id) !== Number(state.activeProposal); });
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
    state.activeOpportunity = Number(id);
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
      '<form id="projectForm" data-id="' + Number(item.id) + '"><div class="form-field"><label for="projectManager">PROJECT MANAGER</label><input id="projectManager" name="project_manager" class="field" maxlength="120" value="' +
      escapeHtml(state.user.display_name || "") + '"></div><div class="form-field"><label for="projectStart">PLANNED START DATE</label><input id="projectStart" name="start_date" class="field" type="date"></div>' +
      '<div class="callout"><strong>Launch controls included:</strong> mobilisation, acceptance baseline, delivery risk, pilot readiness, handover and a 30-day outcomes review. Dates and client owners remain for your team to confirm.</div>' +
      '<div class="modal-actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Create launch plan →</button></div></form>');
  }

  function linesFrom(id) {
    return document.getElementById(id).value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
  }

  function saveProfile(button) {
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
        case_studies: linesFrom("profileCases"),
        certifications: linesFrom("profileCerts"),
      },
    }).then(function (data) {
      state.profile = data.profile;
      notify("Company evidence profile saved.");
      render();
    }).catch(function (error) {
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
      (state.profile.legal_name || "AfroCloud Technologies") + "\n\n" +
      sections.map(function (section) { return section.title.toUpperCase() + "\n\n" + section.text; }).join("\n\n" + "-".repeat(48) + "\n\n");
    downloadText("afrocloud-proposal-" + item.id + ".txt", content, "text/plain;charset=utf-8");
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
    downloadText("afrocloud-bid-pipeline.csv", rows.map(function (row) { return row.map(cell).join(","); }).join("\r\n"), "text/csv;charset=utf-8");
  }

  function exportWorkspaceBackup(button) {
    setBusy(button, true, "Preparing backup…");
    request("export").then(function (backup) {
      var blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      var anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = "afrocloud-bidops-backup-" + new Date().toISOString().slice(0, 10) + ".json";
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
    if (event.target.closest("#previewButton")) {
      startPreview().catch(function (error) { notify(error.message, true); });
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
    else if (name === "export-csv") exportCsv();
    else if (name === "export-backup") exportWorkspaceBackup(action);
    else if (name === "print-report") window.print();
    else if (name === "toggle-user") {
      updateStaff(action.dataset.id, { active: action.dataset.active === "true" }).catch(function (error) { notify(error.message, true); });
    }
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id === "loginForm") {
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
        return loadWorkspace();
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
      state.activeProposal = target.value ? Number(target.value) : null;
      state.proposalSections = [];
      if (state.activeProposal) proposalAction(state.activeProposal);
      else renderProposal();
    } else if (target.id === "interviewSelect") {
      state.activeOpportunity = target.value ? Number(target.value) : null;
      state.interviewQuestions = [];
      renderInterview();
    } else if (target.id === "proposalStatus") {
      if (!state.activeProposal) return;
      var proposalId = state.activeProposal;
      request("proposal", { method: "PATCH", id: proposalId, body: { status: target.value } }).then(function (data) {
        var proposal = state.proposals.find(function (item) { return Number(item.opportunity_id) === Number(proposalId); });
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

  if (previewMode) {
    showSignIn("");
  } else {
    request("session").then(function (data) {
      if (data.mode === "preview") {
        previewMode = true;
        showSignIn("");
        return;
      }
      state.csrf = data.csrf;
      state.user = data.user;
      if (!data.user) {
        showSignIn("");
        return;
      }
      return loadWorkspace();
    }).catch(function (error) {
      showSignIn("");
      document.getElementById("loginError").textContent = error.message + " Check the Netlify, HTTPS and database configuration.";
    });
  }
}());
