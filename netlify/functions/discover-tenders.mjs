const SOURCES = [
  { name: 'TED public procurement notices', hostname: 'ted.europa.eu' },
  { name: 'UK Find a Tender OCDS feed', hostname: 'find-tender.service.gov.uk' },
];

const TED_ENDPOINT = 'https://api.ted.europa.eu/v3/notices/search';
const UK_FEED_ENDPOINT = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages';
const TED_FIELDS = [
  'notice-title',
  'title-proc',
  'publication-number',
  'publication-date',
  'notice-type',
  'buyer-name',
  'description-proc',
  'deadline',
  'deadline-date-part',
  'buyer-country',
  'place-of-performance',
];
const FIT_GROUPS = [
  {
    name: 'Digital learning and training',
    terms: [
      'digital learning', 'e-learning', 'elearning', 'online learning', 'learning platform',
      'learning management system', 'instructional design', 'learning content',
      'microlearning', 'education technology', 'educational technology', 'curriculum development',
      'training platform', 'training content', 'training services', 'digital skills',
    ],
  },
  {
    name: 'Programme and project delivery',
    terms: [
      'programme management', 'program management', 'project management office',
      'project management', 'programme delivery', 'program delivery', 'capacity building',
      'implementation support', 'technical assistance', 'monitoring and evaluation',
    ],
  },
  {
    name: 'Cloud, cybersecurity and digital systems',
    terms: [
      'cloud computing', 'cloud services', 'cybersecurity', 'cyber security',
      'information security', 'data analytics', 'data management', 'digital transformation',
      'software development', 'information technology', 'ict services', 'systems integration',
      'data protection',
    ],
  },
];

const PROFILE_QUERY = 'select=profile_json&id=eq.1&limit=1';
const LOOKBACK_DAYS = 7;
const MAX_SOURCE_RECORDS = 100;
const MAX_SOURCE_PAGES = 3;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured in Netlify.`);
  return value;
}

async function supabase(path, method = 'GET', body) {
  const base = required('SUPABASE_URL').replace(/\/+$/, '');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    console.error('Tender discovery database request failed.', response.status,
      data?.message || data?.code || 'Supabase request error');
    throw new Error(`Supabase request failed with status ${response.status}.`);
  }
  return data;
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    throw new Error(`Public procurement source returned HTTP ${response.status}.`);
  }
  return response.json();
}

function toText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' ');
  if (!value || typeof value !== 'object') return '';
  const preferred = ['eng', 'en', 'en-GB', 'en-US', 'und'];
  for (const language of preferred) {
    if (typeof value[language] === 'string' && value[language].trim()) return value[language];
  }
  const firstText = Object.values(value).find((item) => typeof item === 'string' && item.trim());
  return typeof firstText === 'string' ? firstText : '';
}

function cleanText(value, maximum = 30000) {
  return toText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function parsedDate(value) {
  if (typeof value !== 'string') return null;
  const tedDate = /^(\d{4}-\d{2}-\d{2})(?:[+-]\d{2}:\d{2})?$/.exec(value);
  if (tedDate) {
    const date = new Date(`${tedDate[1]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== tedDate[1]
      ? null
      : date.toISOString();
  }
  if (!Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function validDeadline(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[1]
    ? null
    : match[1];
}

function validSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      SOURCES.some((source) => url.hostname === source.hostname || url.hostname.endsWith(`.${source.hostname}`))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function buildTedQuery(terms, fromDate) {
  const titleAndDescription = terms.flatMap((term) => [
    `notice-title ~ "${term}"`,
    `description-proc ~ "${term}"`,
  ]);
  return `publication-date >= ${fromDate} AND notice-type = cn-standard AND (${titleAndDescription.join(' OR ')})`;
}

async function searchTed(fromDate) {
  const termGroups = [
    ['digital learning', 'e-learning', 'education technology', 'instructional design', 'training content'],
    ['cloud computing', 'cybersecurity', 'digital transformation', 'data analytics', 'systems integration'],
    ['programme management', 'project management', 'capacity building', 'technical assistance'],
  ];
  const results = [];
  const errors = [];
  let searchesCount = 0;
  for (const terms of termGroups) {
    try {
      const query = buildTedQuery(terms, fromDate);
      let totalNoticeCount = 0;
      for (let page = 1; page <= MAX_SOURCE_PAGES; page += 1) {
        const data = await jsonRequest(TED_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            fields: TED_FIELDS,
            limit: MAX_SOURCE_RECORDS,
            page,
          }),
        });
        if (!Array.isArray(data?.notices)) throw new Error('TED API returned an unexpected response.');
        searchesCount += 1;
        totalNoticeCount = Number(data.totalNoticeCount) || 0;
        results.push(...data.notices.map((notice) => mapTedNotice(notice)));
        if (data.notices.length < MAX_SOURCE_RECORDS || page * MAX_SOURCE_RECORDS >= totalNoticeCount) break;
      }
    } catch (error) {
      errors.push(error.message);
      console.error('A TED keyword search failed.', error.message);
    }
  }
  if (!searchesCount) throw new Error(errors.join(' '));
  return { opportunities: results, searchesCount, errors };
}

function mapTedNotice(notice) {
  const publicationNumber = toText(notice?.['publication-number']);
  const title = cleanText(notice?.['notice-title'] || notice?.['title-proc'], 240);
  const funder = cleanText(notice?.['buyer-name'], 190);
  const description = cleanText(notice?.['description-proc']);
  const performance = toText(notice?.['place-of-performance']);
  const country = cleanText(notice?.['buyer-country'] || performance, 100);
  const deadlineValue = toText(notice?.deadline || notice?.['deadline-date-part']);
  return {
    title,
    funder,
    description,
    publishedAt: parsedDate(toText(notice?.['publication-date'])),
    deadline: validDeadline(deadlineValue),
    country,
    currency: 'EUR',
    value: 0,
    sourceName: SOURCES[0].name,
    sourceUrl: publicationNumber
      ? `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(publicationNumber)}`
      : '',
    noticeType: toText(notice?.['notice-type']),
  };
}

function ukFeedUrl(fromDate, toDate) {
  const url = new URL(UK_FEED_ENDPOINT);
  url.searchParams.set('updatedFrom', fromDate.toISOString());
  url.searchParams.set('updatedTo', toDate.toISOString());
  url.searchParams.set('limit', String(MAX_SOURCE_RECORDS));
  return url.toString();
}

async function searchUkFeed(fromDate, toDate) {
  const results = [];
  const errors = [];
  let url = ukFeedUrl(fromDate, toDate);
  let searchesCount = 0;
  for (let page = 0; page < MAX_SOURCE_PAGES && url; page += 1) {
    try {
      const data = await jsonRequest(url);
      if (!Array.isArray(data?.releases)) throw new Error('UK Find a Tender feed returned an unexpected response.');
      searchesCount += 1;
      results.push(...data.releases.map(mapUkNotice));
      const next = data.links?.next;
      if (typeof next !== 'string') break;
      const nextUrl = new URL(next);
      if (nextUrl.protocol !== 'https:' ||
          nextUrl.hostname !== SOURCES[1].hostname ||
          nextUrl.pathname !== '/api/1.0/ocdsReleasePackages') break;
      url = nextUrl.toString();
    } catch (error) {
      errors.push(error.message);
      console.error('A UK Find a Tender feed page failed.', error.message);
      break;
    }
  }
  if (!searchesCount) throw new Error(errors.join(' ') || 'UK Find a Tender feed returned no pages.');
  return { opportunities: results, searchesCount, errors };
}

function mapUkNotice(release) {
  const tender = release?.tender || {};
  const buyer = release?.buyer?.name ||
    release?.parties?.find((party) => Array.isArray(party.roles) && party.roles.includes('buyer'))?.name;
  const id = toText(release?.id);
  const tenderPeriod = tender.tenderPeriod || {};
  const value = Number(tender.value?.amount);
  return {
    title: cleanText(tender.title, 240),
    funder: cleanText(buyer, 190),
    description: cleanText(tender.description),
    publishedAt: parsedDate(toText(release?.date || release?.publishedDate)),
    deadline: validDeadline(toText(tenderPeriod.endDate)),
    country: 'United Kingdom',
    currency: /^[A-Z]{3}$/.test(tender.value?.currency || '') ? tender.value.currency : 'GBP',
    value: Number.isFinite(value) && value >= 0 ? value : 0,
    sourceName: SOURCES[1].name,
    sourceUrl: id ? `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(id)}` : '',
    noticeType: toText(release?.tag),
  };
}

function matchFit(candidate, profile) {
  const searchable = `${candidate.title} ${candidate.description}`.toLowerCase();
  const matched = new Set();
  const matchedGroups = [];
  for (const group of FIT_GROUPS) {
    const hits = group.terms.filter((term) => searchable.includes(term));
    if (hits.length) {
      matchedGroups.push(group.name);
      hits.forEach((hit) => matched.add(hit));
    }
  }
  const capabilities = Array.isArray(profile?.capabilities) ? profile.capabilities.slice(0, 20) : [];
  for (const capability of capabilities) {
    if (typeof capability !== 'string') continue;
    const phrase = capability.trim().toLowerCase();
    if (phrase.length >= 8 && searchable.includes(phrase)) matched.add(capability.trim());
  }
  if (!matched.size) return null;
  const fitScore = Math.min(95, 40 + matchedGroups.length * 12 + matched.size * 5);
  if (fitScore < 55) return null;
  return {
    fitScore,
    matched: [...matched].slice(0, 12),
    reason: `Keyword match across ${matchedGroups.join(', ') || 'company capabilities'}. This is a preliminary screen, not an eligibility decision.`,
  };
}

async function recordRun(id, fields) {
  await supabase(`discovery_runs?id=eq.${encodeURIComponent(id)}`, 'PATCH', fields);
}

async function runDiscovery() {
  const runRows = await supabase('discovery_runs', 'POST', {
    status: 'running',
    sources_json: SOURCES.map((source) => source.name),
  });
  const runId = runRows?.[0]?.id;
  if (!runId) throw new Error('Could not create discovery run record.');

  try {
    const profiles = await supabase(`company_profile?${PROFILE_QUERY}`);
    const profile = profiles?.[0]?.profile_json || {};
    const now = new Date();
    const fromDate = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const tedFromDate = fromDate.toISOString().slice(0, 10).replace(/-/g, '');
    const feedResults = [];
    const sourceErrors = [];
    let searchesCount = 0;

    try {
      const ted = await searchTed(tedFromDate);
      feedResults.push(...ted.opportunities);
      searchesCount += ted.searchesCount;
      if (ted.errors.length) sourceErrors.push(`TED partial failure: ${ted.errors.join(' ')}`);
    } catch (error) {
      sourceErrors.push(`TED: ${error.message}`);
      console.error('TED public notices search failed.', error.message);
    }
    try {
      const uk = await searchUkFeed(fromDate, now);
      feedResults.push(...uk.opportunities);
      searchesCount += uk.searchesCount;
      if (uk.errors.length) sourceErrors.push(`UK Find a Tender partial failure: ${uk.errors.join(' ')}`);
    } catch (error) {
      sourceErrors.push(`UK Find a Tender: ${error.message}`);
      console.error('UK Find a Tender feed request failed.', error.message);
    }
    if (!searchesCount) throw new Error(sourceErrors.join(' '));

    const unique = new Map();
    for (const candidate of feedResults) {
      const sourceUrl = validSource(candidate.sourceUrl);
      const publishedAt = candidate.publishedAt;
      const publishedTime = publishedAt ? Date.parse(publishedAt) : NaN;
      const deadline = candidate.deadline;
      if (!sourceUrl || !candidate.title || !candidate.funder || !Number.isFinite(publishedTime)) continue;
      if (publishedTime < fromDate.getTime() || publishedTime > now.getTime() + 24 * 60 * 60 * 1000) continue;
      if (deadline && deadline < now.toISOString().slice(0, 10)) continue;
      if (candidate.sourceName === SOURCES[0].name && !candidate.noticeType.startsWith('cn')) continue;
      const fit = matchFit(candidate, profile);
      if (!fit) continue;
      unique.set(sourceUrl, { ...candidate, sourceUrl, publishedAt, deadline, fit });
    }

    const candidates = [...unique.values()];
    const existingUrls = new Set();
    for (let offset = 0; offset < candidates.length; offset += 50) {
      const sourceUrls = candidates.slice(offset, offset + 50).map((candidate) => `"${candidate.sourceUrl}"`);
      const filter = encodeURIComponent(`in.(${sourceUrls.join(',')})`);
      const existing = await supabase(`opportunities?select=source_url&source_url=${filter}`);
      for (const row of existing || []) existingUrls.add(row.source_url);
    }

    const newCandidates = candidates.filter((candidate) => !existingUrls.has(candidate.sourceUrl));
    const records = newCandidates.map((candidate) => ({
        title: candidate.title,
        funder: candidate.funder,
        funder_type: 'Public procurement / institutional opportunity',
        sector: candidate.fit.matched.join(', ').slice(0, 100) || 'Digital services',
        country: candidate.country,
        currency: candidate.currency,
        value: candidate.value,
        deadline: candidate.deadline,
        stage: 'Discovered',
        requirements: candidate.description.slice(0, 30000),
        owner: '',
        notes: `Daily public-source discovery from ${candidate.sourceName}. Confirm the original notice, supplier eligibility, live status and deadline before bidding. ${candidate.fit.reason}`,
        fit_score: candidate.fit.fitScore,
        fit_json: {
          basis: 'Deterministic keyword screening of public notice text; not an eligibility decision.',
          matched: candidate.fit.matched,
          review: [
            'Check whether the notice accepts suppliers based in Kenya/East Africa.',
            'Confirm mandatory registrations, qualification criteria and current deadline on the buyer notice.',
          ],
          fit_reason: candidate.fit.reason,
        },
        source_name: candidate.sourceName,
        source_url: candidate.sourceUrl,
        source_published_at: candidate.publishedAt,
        discovered_at: now.toISOString(),
        created_by: null,
    }));

    let added = 0;
    for (let offset = 0; offset < records.length; offset += 25) {
      const inserted = await supabase('opportunities', 'POST', records.slice(offset, offset + 25));
      added += Array.isArray(inserted) ? inserted.length : 0;
    }

    const warning = sourceErrors.length ? sourceErrors.join(' ').slice(0, 500) : null;
    await recordRun(runId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      searches_count: searchesCount,
      candidates_count: unique.size,
      added_count: added,
      error_message: warning,
    });
    try {
      await supabase('audit_log', 'POST', {
        user_id: null,
        action: 'auto_discover',
        entity_type: 'discovery',
        entity_id: runId,
        detail_json: {
          sources: SOURCES.map((source) => source.name),
          searches_count: searchesCount,
          candidates_count: unique.size,
          added_count: added,
          warning,
        },
      });
    } catch (error) {
      console.error('Public-source discovery completed but its audit event could not be saved.', error.message);
    }
    console.info('Daily public-source discovery completed.', {
      searchesCount, candidates: unique.size, added, warning,
    });
    return { searchesCount, candidates: unique.size, added, warning };
  } catch (error) {
    await recordRun(runId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error.message.slice(0, 500),
    });
    throw error;
  }
}

export default async function handler() {
  try {
    await runDiscovery();
    return new Response('Daily public-source discovery completed.', { status: 200 });
  } catch (error) {
    console.error('Daily public-source discovery failed.', error.message);
    return new Response('Daily public-source discovery failed. Check function logs and required Netlify environment variables.', { status: 500 });
  }
}

export const config = { schedule: '@daily' };
