import { createHmac } from 'node:crypto';

const STAGES = ['Discovered', 'GoNoGo', 'Drafting', 'Review', 'Submitted', 'Won', 'Lost', 'NoGo'];
const USERS = new Set(['owner', 'manager', 'writer']);
const PROFILE_DEFAULTS = {
  legal_name: 'AfroCloud Technologies',
  website: '',
  pitch: 'Digital learning, cloud services and programme delivery.',
  capabilities: [
    'Digital learning content', 'Microlearning and performance support',
    'Scenario-based and experiential learning', 'AR / VR simulations',
    'Gamification and badges', 'Video and animation', 'Mobile-first design',
    'Translation and localisation', 'LMS integration and enablement',
    'AI-assisted instructional design', 'Cloud services and cybersecurity',
    'Programme delivery and PMO', 'Data, assessment and analytics',
  ],
  operating_countries: [],
  case_studies: [],
  certifications: [],
  positioning_note: 'Starting profile based on the supplied prototype. Verify services, registrations, metrics and references before using in a client proposal.',
};
const MILESTONE_TITLES = [
  'Kick-off and mobilisation',
  'Requirements and acceptance baseline',
  'Delivery plan and risk register',
  'Pilot / readiness review',
  'Launch and stakeholder handover',
  '30-day outcomes review',
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(503, 'Live services are not configured. Use the interactive preview or finish deployment setup.');
  return value;
}

function liveConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.AFROCLOUD_APP_KEY &&
    process.env.AFROCLOUD_APP_KEY.length >= 32);
}

function text(value, maximum, label, required = false) {
  if (typeof value !== 'string') throw new HttpError(400, `Invalid ${label}.`);
  const result = value.trim();
  if ((required && !result) || [...result].length > maximum) {
    throw new HttpError(400, `Please check the ${label}.`);
  }
  return result;
}

function dateValue(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  return value;
}

async function supabase(path, options = {}, privileged = true) {
  const base = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const key = privileged ? requiredEnv('SUPABASE_SERVICE_ROLE_KEY') : requiredEnv('SUPABASE_ANON_KEY');
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      apikey: key,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : { Authorization: `Bearer ${key}` }),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }
  if (!response.ok) {
    console.error('BidOps Supabase request failed.', response.status,
      typeof data === 'string' ? data.slice(0, 250) : data?.message || data?.error || data?.code);
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(response.status, 'The account could not be authorised for this action.');
    }
    if (response.status === 409) throw new HttpError(409, 'The record conflicts with existing workspace data.');
    if (response.status === 404) throw new HttpError(404, 'The requested record was not found.');
    throw new HttpError(503, 'The workspace database could not complete this request. Check the Netlify and Supabase setup.');
  }
  return { data, response };
}

function rows(data) {
  return Array.isArray(data) ? data : [];
}

async function parseBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 262144) throw new HttpError(413, 'Request body is too large.');
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch {
    throw new HttpError(400, 'Invalid JSON request.');
  }
}

async function select(table, query) {
  const result = await supabase(`/rest/v1/${table}?${query}`);
  return rows(result.data);
}

async function write(table, method, query, body, prefer = 'return=representation') {
  const result = await supabase(`/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: { Prefer: prefer },
    body,
  });
  return result.data;
}

async function audit(userId, action, entity, entityId, detail = null) {
  await write('audit_log', 'POST', '', {
    user_id: userId,
    action,
    entity_type: entity,
    entity_id: entityId == null ? null : String(entityId),
    detail_json: detail,
  }, 'return=minimal');
}

function bearer(request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) throw new HttpError(401, 'Please sign in to continue.');
  return match[1];
}

async function userFromToken(token) {
  const { data: authUser } = await supabase('/auth/v1/user', { token }, false);
  if (!authUser || typeof authUser.id !== 'string') throw new HttpError(401, 'Please sign in again.');
  const profiles = await select('bid_users',
    `select=user_id,display_name,role,active&user_id=eq.${encodeURIComponent(authUser.id)}&active=eq.true&limit=1`);
  const profile = profiles[0];
  if (!profile || !USERS.has(profile.role)) throw new HttpError(403, 'This account does not have AfroCloud BidOps access.');
  return {
    id: authUser.id,
    username: authUser.email || authUser.id,
    display_name: profile.display_name,
    role: profile.role,
  };
}

function requireManager(user) {
  if (!['owner', 'manager'].includes(user.role)) {
    throw new HttpError(403, 'Manager access is required for this action.');
  }
}

async function loginRateLimit(request) {
  const appKey = requiredEnv('AFROCLOUD_APP_KEY');
  if (appKey.length < 32) throw new HttpError(503, 'The login service is not configured.');
  const ip = request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!ip) throw new HttpError(503, 'The request could not be verified.');
  const identity = createHmac('sha256', appKey).update(`login:${ip}`).digest('hex');
  const { data } = await supabase('/rest/v1/rpc/afc_record_login_hit', {
    method: 'POST',
    body: { p_identity_hash: identity, p_limit: 10 },
  });
  const hits = Number(data);
  if (!Number.isSafeInteger(hits) || hits < 1) throw new HttpError(503, 'Login rate limiting is unavailable.');
  if (hits > 10) throw new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes.');
}

async function getProfile() {
  const profile = await select('company_profile', 'select=profile_json&id=eq.1&limit=1');
  return profile[0] ? { ...PROFILE_DEFAULTS, ...profile[0].profile_json } : PROFILE_DEFAULTS;
}

async function getOpportunity(id) {
  const result = await select('opportunities', `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return result[0] || null;
}

function fit(textValue, profile) {
  const haystack = ` ${textValue.toLowerCase()} `;
  const matched = (profile.capabilities || []).filter((capability) => {
    const words = capability.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
    return words.some((word) => haystack.includes(word));
  });
  const score = matched.length ? Math.min(95, 20 + matched.length * 12) : 15;
  const review = [];
  for (const [needle, action] of [
    ['bid bond', 'Confirm bid-security requirement and issuer eligibility.'],
    ['joint venture', 'Confirm whether a qualified joint-venture partner is required.'],
    ['minimum turnover', 'Verify audited turnover against the stated threshold.'],
    ['audited financial', 'Confirm the required audited financial statements are available.'],
    ['mandatory site visit', 'Confirm attendance, location and evidence for the mandatory site visit.'],
    ['consortium', 'Confirm consortium structure and lead-member eligibility.'],
  ]) {
    if (haystack.includes(needle)) review.push(action);
  }
  return { score, matched: [...new Set(matched)], review, basis: 'Keyword screening only. Confirm mandatory eligibility and evidence manually.' };
}

function proposalSections(opportunity, profile) {
  const country = opportunity.country || '[confirm delivery country]';
  return [
    {
      title: 'Executive summary',
      text: `${profile.legal_name} is pleased to submit this proposal to ${opportunity.funder} for "${opportunity.title}". We propose a practical, measurable response aligned to the stated scope in ${country}. Confirm the delivery model, duration, learner numbers and outcome targets with the project team before submission.\n\nCompany positioning supplied by the bid team: ${profile.pitch}\nConfirm this positioning is accurate and relevant before submission.`,
    },
    {
      title: 'Understanding of the requirement',
      text: `RFP requirements supplied by the bid team:\n${opportunity.requirements || '[Paste and verify the relevant terms of reference.]'}\n\nBefore approval, map every mandatory requirement to a response and a named evidence source.`,
    },
    {
      title: 'Technical approach and delivery',
      text: '1. Discover: validate users, context, constraints and success measures with the client.\n2. Design: agree solution blueprint, work plan, accessibility and acceptance criteria.\n3. Build: deliver in reviewable increments with documented quality checks.\n4. Launch: pilot, train administrators, transition operations and resolve launch blockers.\n5. Improve: report agreed outcome measures and recommendations.\n\nTailor every phase to the RFP; remove activities that are outside scope.',
    },
    {
      title: 'Work plan and deliverables',
      text: 'Discovery and mobilisation: [dates, outputs, client inputs]\nDesign and approval: [dates, outputs, approval owner]\nProduction and QA: [dates, outputs, acceptance criteria]\nPilot and launch: [dates, readiness gates, support model]\nEvaluation and handover: [dates, measures, ownership]\n\nReplace brackets with a priced, resourced schedule that matches the RFP.',
    },
    {
      title: 'Team and governance',
      text: 'Project manager: [name, relevant experience, availability]\nTechnical / delivery lead: [name and verified credentials]\nQuality lead: [name and quality responsibilities]\nClient governance: [meeting cadence, decision-makers, escalation path]\n\nAttach approved CVs and confirm each named person is available for the full delivery period.',
    },
    {
      title: 'Quality, safeguarding and risk',
      text: 'Use agreed acceptance criteria, traceable reviews, accessibility checks and documented change control. Identify data protection, safeguarding, security, local delivery and continuity risks in a project-specific register. For each risk, name an owner, mitigation and escalation trigger. Do not claim a certification or control unless evidence is attached.',
    },
    {
      title: 'Relevant experience and evidence',
      text: `Capability profile supplied by the bid team:\n${(profile.capabilities || []).map((item) => `- ${item}`).join('\n') || '[add verified capabilities]'}\n\nVerified case studies entered in the company profile:\n${(profile.case_studies || []).map((item) => `- ${item}`).join('\n') || '[insert comparable case studies with client permission, dates, outcomes and references]'}\n\nConfirm relevance, client permissions and evidence before submission. No customer names, performance metrics, offices or credentials have been inferred by this draft.`,
    },
    {
      title: 'Financial proposal and compliance',
      text: `Currency: ${opportunity.currency}\nIndicative opportunity value in the notice: ${Number(opportunity.value || 0).toFixed(2)}\n\nCredentials listed in the company profile (verify scope and expiry):\n${(profile.certifications || []).map((item) => `- ${item}`).join('\n') || '[add verified registrations or certifications, if required]'}\n\nAdd a costed budget, assumptions, taxes, reimbursables, payment milestones and validity period using the buyer's required format. Complete the compliance matrix against the final RFP and attach signed forms.`,
    },
  ];
}

function interviewPack(opportunity) {
  const matched = opportunity.fit_json?.matched || [];
  const capability = matched[0] || 'the proposed delivery approach';
  return [
    ['How does your solution directly address the buyer’s most important outcomes?', 'Lead with the buyer’s stated outcome, map it to one proposed deliverable, explain how success is measured, and cite only verified evidence.'],
    ['What makes your team qualified to deliver this scope?', 'Name the proposed people, their relevant responsibilities and availability. Use a comparable, permissioned case study; do not rely on unsupported company-wide claims.'],
    ['How will you manage delivery risk, quality and changes?', 'Give one real risk, its owner, early warning signal, mitigation and escalation route. Explain acceptance gates and change control.'],
    ['How will you demonstrate value for money and measurable impact?', 'Tie cost assumptions to work packages and outcomes. Explain baseline, target, data source, reporting cadence and what is excluded.'],
    ['What would you do if the buyer’s constraints or requirements changed?', 'Explain discovery, impact assessment, options, written approval and how the team protects critical milestones.'],
    [`How will you deliver ${capability} in this context?`, 'Describe a concrete method, a relevant example if verified, quality checks, local/user considerations and evidence you can show at the interview.'],
    ['What do you need from us in the first 30 days?', 'State the decisions, access, subject-matter input, data and approvals needed, who supplies them, and the risk if they are delayed.'],
  ].map(([question, framework]) => ({ question, framework }));
}

async function handle(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('route') || '';
  const method = request.method.toUpperCase();
  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (isMutating) {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new HttpError(403, 'Request origin could not be verified.');
  }

  if (!liveConfigured()) {
    if (route === 'session' && method === 'GET') return json(200, { ok: true, mode: 'preview', configured: false, user: null });
    throw new HttpError(503, 'This deployment is in interactive preview mode. Configure Supabase to enable live accounts and data.');
  }
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');

  if (route === 'session' && method === 'GET') {
    const token = request.headers.get('authorization');
    if (!token) return json(200, { ok: true, mode: 'live', configured: true, user: null });
    const user = await userFromToken(bearer(request));
    return json(200, { ok: true, mode: 'live', configured: true, user });
  }

  if (route === 'login' && method === 'POST') {
    await loginRateLimit(request);
    const input = await parseBody(request);
    const username = text(input.username, 190, 'username', true);
    const password = text(input.password, 72, 'password', true);
    const { data: session } = await supabase('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: username, password },
    }, false);
    if (!session?.access_token || !session?.refresh_token) throw new HttpError(401, 'The username or password was not recognised.');
    const user = await userFromToken(session.access_token);
    await audit(user.id, 'sign_in', 'user', user.id);
    return json(200, {
      ok: true,
      mode: 'live',
      user,
      csrf: '',
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    });
  }

  if (route === 'refresh' && method === 'POST') {
    const input = await parseBody(request);
    const refreshToken = text(input.refresh_token, 4096, 'refresh token', true);
    const { data: session } = await supabase('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    }, false);
    if (!session?.access_token || !session?.refresh_token) throw new HttpError(401, 'Please sign in again.');
    const user = await userFromToken(session.access_token);
    return json(200, {
      ok: true,
      user,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    });
  }

  if (route === 'logout' && method === 'POST') {
    const user = await userFromToken(bearer(request));
    await audit(user.id, 'sign_out', 'user', user.id);
    await supabase('/auth/v1/logout', { method: 'POST', token: bearer(request) }, false);
    return json(200, { ok: true });
  }

  const user = await userFromToken(bearer(request));
  let input;
  if (isMutating) {
    input = await parseBody(request);
  }

  if (route === 'bootstrap' && method === 'GET') {
    const [opportunities, projectRows, proposalRows, activityRows, profile] = await Promise.all([
      select('opportunities', 'select=*&order=deadline.asc.nullslast,updated_at.desc'),
      select('projects', 'select=*&order=updated_at.desc'),
      select('proposals', 'select=id,opportunity_id,status,updated_at,opportunities(title)&order=updated_at.desc'),
      select('audit_log', 'select=action,entity_type,entity_id,created_at,user_id&order=created_at.desc&limit=20'),
      getProfile(),
    ]);
    const opportunityIds = opportunities.map((item) => item.id);
    const projectIds = projectRows.map((item) => item.id);
    const userIds = [...new Set(activityRows.map((item) => item.user_id).filter(Boolean))];
    const [milestones, linkedOpps] = await Promise.all([
      projectIds.length ? select('milestones', `select=*&project_id=in.(${projectIds.join(',')})&order=created_at.asc`) : [],
      opportunityIds.length ? select('opportunities', `select=id,title,funder,value,currency&id=in.(${opportunityIds.join(',')})`) : [],
    ]);
    const auditUsers = userIds.length
      ? await select('bid_users', `select=user_id,display_name&user_id=in.(${userIds.join(',')})`)
      : [];
    const displayNames = new Map(auditUsers.map((item) => [item.user_id, item.display_name]));
    const activity = activityRows.map((item) => ({
      ...item,
      display_name: displayNames.get(item.user_id) || 'Workspace user',
    }));
    const byProject = new Map(projectRows.map((project) => [project.id, []]));
    for (const milestone of milestones) byProject.get(milestone.project_id)?.push(milestone);
    const oppMap = new Map(linkedOpps.map((item) => [item.id, item]));
    const projects = projectRows.map((project) => {
      const opportunity = oppMap.get(project.opportunity_id) || {};
      return {
        ...project,
        opportunity_title: opportunity.title || '',
        funder: opportunity.funder || '',
        value: Number(opportunity.value || 0),
        currency: opportunity.currency || 'USD',
        milestones: byProject.get(project.id) || [],
      };
    });
    const proposals = proposalRows.map((item) => ({
      id: item.id,
      opportunity_id: item.opportunity_id,
      status: item.status,
      updated_at: item.updated_at,
      opportunity_title: Array.isArray(item.opportunities) ? item.opportunities[0]?.title || '' : item.opportunities?.title || '',
    }));
    return json(200, { ok: true, user, csrf: '', profile, opportunities, projects, proposals, activity });
  }

  if (route === 'users' && method === 'GET') {
    requireManager(user);
    const members = await select('bid_users',
      'select=user_id,email,display_name,role,active,created_at&order=created_at.asc');
    return json(200, { ok: true, users: members });
  }

  if (route === 'users' && method === 'POST') {
    requireManager(user);
    const email = text(input.email, 254, 'email', true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid staff email address.');
    const displayName = text(input.display_name, 120, 'display name', true);
    const role = text(input.role, 20, 'role', true);
    if (!['manager', 'writer'].includes(role) || (user.role !== 'owner' && role !== 'writer')) {
      throw new HttpError(403, 'Only the workspace owner can invite another manager.');
    }
    const redirectTo = `${url.origin}/`;
    const invitePath = `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`;
    const { data: invited } = await supabase(invitePath, {
      method: 'POST',
      body: { email, data: { display_name: displayName } },
    });
    const authUserId = invited?.id || invited?.user?.id;
    if (typeof authUserId !== 'string') {
      throw new HttpError(503, 'The invitation was not completed. Confirm Supabase email delivery and try again.');
    }
    try {
      await write('bid_users', 'POST', '', {
        user_id: authUserId,
        email,
        display_name: displayName,
        role,
        active: true,
      });
    } catch (error) {
      try {
        await supabase(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, { method: 'DELETE' });
      } catch (cleanupError) {
        console.error('BidOps could not roll back an unprovisioned invited user.', authUserId, cleanupError);
      }
      throw error;
    }
    await audit(user.id, 'invite', 'user', authUserId, { email, role });
    return json(201, {
      ok: true,
      user: { user_id: authUserId, email, display_name: displayName, role, active: true },
      message: 'Invitation sent. The staff member must use the email link to set a password.',
    });
  }

  if (route === 'user' && method === 'PATCH') {
    requireManager(user);
    const targetId = url.searchParams.get('id') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      throw new HttpError(400, 'Invalid staff account.');
    }
    if (targetId === user.id) throw new HttpError(400, 'You cannot change your own workspace access here.');
    const targets = await select('bid_users',
      `select=user_id,email,display_name,role,active,created_at&user_id=eq.${encodeURIComponent(targetId)}&limit=1`);
    const target = targets[0];
    if (!target) throw new HttpError(404, 'Staff account not found.');
    if (target.role === 'owner') throw new HttpError(403, 'Owner accounts cannot be changed from Team access.');
    if (user.role !== 'owner' && target.role !== 'writer') {
      throw new HttpError(403, 'Only the workspace owner can manage another manager.');
    }
    const patch = {};
    if (Object.hasOwn(input, 'active')) {
      if (typeof input.active !== 'boolean') throw new HttpError(400, 'Invalid account status.');
      patch.active = input.active;
    }
    if (Object.hasOwn(input, 'role')) {
      if (!['manager', 'writer'].includes(input.role) || (user.role !== 'owner' && input.role !== 'writer')) {
        throw new HttpError(403, 'Only the workspace owner can assign manager access.');
      }
      patch.role = input.role;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'No staff account changes were provided.');
    const updated = await write('bid_users', 'PATCH',
      `user_id=eq.${encodeURIComponent(targetId)}&select=user_id,email,display_name,role,active,created_at`,
      patch);
    const member = rows(updated)[0];
    if (!member) throw new HttpError(404, 'Staff account not found.');
    await audit(user.id, 'update', 'user', targetId, patch);
    return json(200, { ok: true, user: member });
  }

  if (route === 'profile' && method === 'PUT') {
    requireManager(user);
    const website = text(input.website ?? '', 240, 'website');
    if (website) {
      try {
        if (new URL(website).protocol !== 'https:') throw new Error('HTTPS required');
      } catch {
        throw new HttpError(400, 'Enter a valid HTTPS company website.');
      }
    }
    const profile = {
      legal_name: text(input.legal_name, 160, 'company name', true),
      website,
      pitch: text(input.pitch ?? '', 1200, 'company summary'),
      capabilities: [],
      operating_countries: [],
      case_studies: [],
      certifications: [],
      positioning_note: 'Confirm all claims and attach supporting evidence before external use.',
    };
    for (const key of ['capabilities', 'operating_countries', 'case_studies', 'certifications']) {
      const items = input[key] ?? [];
      if (!Array.isArray(items) || items.length > 40) throw new HttpError(400, 'Invalid company profile list.');
      profile[key] = items.map((item) => text(item, key === 'case_studies' ? 1200 : 240, 'company profile item', true));
    }
    await write('company_profile', 'POST', 'on_conflict=id', { id: 1, profile_json: profile }, 'resolution=merge-duplicates,return=minimal');
    await audit(user.id, 'update', 'company_profile', 1);
    return json(200, { ok: true, profile });
  }

  if (route === 'opportunities' && method === 'POST') {
    requireManager(user);
    const title = text(input.title, 240, 'title', true);
    const funder = text(input.funder, 190, 'funder', true);
    const requirements = text(input.requirements ?? '', 30000, 'requirements');
    const value = Number(input.value || 0);
    if (!Number.isFinite(value) || value < 0 || value > 1e12) throw new HttpError(400, 'Invalid opportunity value.');
    const currency = text(input.currency || 'USD', 3, 'currency', true).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'Use a 3-letter currency code.');
    const match = fit(`${title} ${requirements}`, await getProfile());
    const savedRows = await write('opportunities', 'POST', '', {
      title,
      funder,
      funder_type: text(input.funder_type ?? '', 80, 'funder type'),
      sector: text(input.sector ?? '', 100, 'sector'),
      country: text(input.country ?? '', 100, 'country'),
      currency,
      value,
      deadline: dateValue(input.deadline, 'deadline'),
      requirements,
      owner: text(input.owner ?? '', 120, 'owner'),
      stage: 'Discovered',
      notes: '',
      fit_score: match.score,
      fit_json: match,
      created_by: user.id,
    });
    const opportunity = Array.isArray(savedRows) ? savedRows[0] : savedRows;
    await audit(user.id, 'create', 'opportunity', opportunity?.id);
    return json(201, { ok: true, opportunity });
  }

  if (route === 'opportunity' && method === 'PATCH') {
    requireManager(user);
    const id = url.searchParams.get('id') || '';
    const existing = await getOpportunity(id);
    if (!existing) throw new HttpError(404, 'Opportunity not found.');
    const patch = {};
    for (const [key, maximum] of Object.entries({ title: 240, funder: 190, owner: 120, notes: 5000, requirements: 30000 })) {
      if (Object.hasOwn(input, key)) patch[key] = text(input[key], maximum, key, ['title', 'funder'].includes(key));
    }
    if (Object.hasOwn(input, 'stage')) {
      if (!STAGES.includes(input.stage)) throw new HttpError(400, 'Invalid opportunity stage.');
      patch.stage = input.stage;
    }
    if (Object.hasOwn(input, 'deadline')) patch.deadline = dateValue(input.deadline, 'deadline');
    if (Object.hasOwn(input, 'value')) {
      patch.value = Number(input.value);
      if (!Number.isFinite(patch.value) || patch.value < 0 || patch.value > 1e12) throw new HttpError(400, 'Invalid opportunity value.');
    }
    if (Object.hasOwn(input, 'title') || Object.hasOwn(input, 'requirements')) {
      const match = fit(`${patch.title ?? existing.title} ${patch.requirements ?? existing.requirements}`, await getProfile());
      patch.fit_score = match.score;
      patch.fit_json = match;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'No opportunity changes were provided.');
    const result = await write('opportunities', 'PATCH', `id=eq.${encodeURIComponent(id)}&select=*`, patch);
    const opportunity = rows(result)[0];
    if (!opportunity) throw new HttpError(404, 'Opportunity not found.');
    await audit(user.id, 'update', 'opportunity', id);
    return json(200, { ok: true, opportunity });
  }

  const id = url.searchParams.get('id') || '';
  if (route === 'proposal' && method === 'GET') {
    const result = await select('proposals', `select=*&opportunity_id=eq.${encodeURIComponent(id)}&limit=1`);
    const proposal = result[0] || null;
    if (proposal) {
      const opportunity = await getOpportunity(id);
      proposal.opportunity_title = opportunity?.title || '';
      proposal.funder = opportunity?.funder || '';
    }
    return json(200, { ok: true, proposal });
  }

  if (route === 'proposal' && method === 'PATCH') {
    const status = input.status;
    if (!['Draft', 'In review', 'Approved'].includes(status)) throw new HttpError(400, 'Invalid proposal review status.');
    if (status === 'Approved') requireManager(user);
    const updated = await write('proposals', 'PATCH',
      `opportunity_id=eq.${encodeURIComponent(id)}&select=id`,
      { status, updated_by: user.id });
    if (!rows(updated).length) throw new HttpError(404, 'Proposal draft not found.');
    await audit(user.id, 'review_status', 'proposal', id, { status });
    return json(200, { ok: true, status });
  }

  if (route === 'proposal' && method === 'POST') {
    const opportunity = await getOpportunity(id);
    if (!opportunity) throw new HttpError(404, 'Opportunity not found.');
    let sections = proposalSections(opportunity, await getProfile());
    if (Object.hasOwn(input, 'sections')) {
      if (!Array.isArray(input.sections) || input.sections.length > 30) throw new HttpError(400, 'Invalid proposal sections.');
      sections = input.sections.map((section) => ({
        title: text(section?.title, 160, 'section title', true),
        text: text(section?.text, 20000, 'section text'),
      }));
    }
    await write('proposals', 'POST', 'on_conflict=opportunity_id', {
      opportunity_id: id,
      sections_json: sections,
      updated_by: user.id,
      status: 'Draft',
    }, 'resolution=merge-duplicates,return=minimal');
    await audit(user.id, Object.hasOwn(input, 'sections') ? 'edit' : 'generate', 'proposal', id);
    return json(200, { ok: true, sections });
  }

  if (route === 'interview' && method === 'POST') {
    const opportunity = await getOpportunity(id);
    if (!opportunity) throw new HttpError(404, 'Opportunity not found.');
    const questions = interviewPack(opportunity);
    const existing = await select('proposals', `select=id&opportunity_id=eq.${encodeURIComponent(id)}&limit=1`);
    if (existing.length) {
      await write('proposals', 'PATCH', `opportunity_id=eq.${encodeURIComponent(id)}`, {
        interview_json: questions,
        updated_by: user.id,
      }, 'return=minimal');
    } else {
      await write('proposals', 'POST', '', {
        opportunity_id: id,
        sections_json: proposalSections(opportunity, await getProfile()),
        interview_json: questions,
        updated_by: user.id,
      }, 'return=minimal');
    }
    await audit(user.id, 'prepare', 'interview', id);
    return json(200, { ok: true, questions });
  }

  if (route === 'project' && method === 'POST') {
    requireManager(user);
    const opportunity = await getOpportunity(id);
    if (!opportunity) throw new HttpError(404, 'Opportunity not found.');
    if (opportunity.stage !== 'Won') throw new HttpError(409, 'Mark the opportunity Won after award confirmation before creating its launch plan.');
    const project = await write('projects', 'POST', 'on_conflict=opportunity_id', {
      opportunity_id: id,
      project_manager: text(input.project_manager ?? '', 120, 'project manager'),
      start_date: dateValue(input.start_date, 'start date'),
    }, 'resolution=merge-duplicates,return=representation');
    const projectId = rows(project)[0]?.id || (await select('projects', `select=id&opportunity_id=eq.${encodeURIComponent(id)}&limit=1`))[0]?.id;
    if (!projectId) throw new HttpError(503, 'Could not create the project launch plan.');
    const existing = await select('milestones', `select=id&project_id=eq.${encodeURIComponent(projectId)}&limit=1`);
    if (!existing.length) {
      for (const title of MILESTONE_TITLES) {
        await write('milestones', 'POST', '', { project_id: projectId, title }, 'return=minimal');
      }
    }
    await audit(user.id, 'launch_plan', 'project', projectId);
    return json(200, { ok: true, project_id: projectId });
  }

  if (route === 'milestone' && method === 'PATCH') {
    requireManager(user);
    if (!['Not started', 'In progress', 'Done', 'At risk'].includes(input.status)) {
      throw new HttpError(400, 'Invalid milestone status.');
    }
    const updated = await write('milestones', 'PATCH',
      `id=eq.${encodeURIComponent(id)}&select=id`,
      { status: input.status });
    if (!rows(updated).length) throw new HttpError(404, 'Milestone not found.');
    await audit(user.id, 'update', 'milestone', id, { status: input.status });
    return json(200, { ok: true });
  }

  throw new HttpError(404, 'API route not found.');
}

export default async function api(request) {
  if (!(request instanceof Request)) throw new TypeError('Expected a Netlify Web Request.');
  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { ok: false, error: error.message });
    console.error('AfroCloud BidOps API request failed.', error);
    return json(500, { ok: false, error: 'The request could not be completed. Please try again.' });
  }
}
