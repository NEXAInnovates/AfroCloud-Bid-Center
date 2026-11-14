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

async function searchTed(termGroups, fromDate) {
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

const MATCH_STOP_WORDS = new Set(['with', 'from', 'into', 'that', 'this', 'your', 'their', 'about', 'service', 'services', 'solution', 'solutions', 'support', 'system', 'systems']);

function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function profileItems(items) {
  return Array.isArray(items) ? [...new Set(items.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))] : [];
}

function matchesItem(item, searchable) {
  const phrase = normalized(item);
  if (!phrase) return false;
  if (` ${searchable} `.includes(` ${phrase} `)) return true;
  const words = phrase.split(' ').filter((word) => word.length > 3 && !MATCH_STOP_WORDS.has(word));
  if (!words.length) return false;
  const hits = words.filter((word) => searchable.includes(word)).length;
  return hits >= Math.max(1, Math.ceil(words.length * 0.6));
}

function matchFit(candidate, profile) {
  const searchable = normalized([
    candidate.title, candidate.description, candidate.country, candidate.funder,
  ].join(' '));
  const dimensions = [];
  const matched = [];
  const missing = [];
  const addDimension = (label, items, weight) => {
    const values = profileItems(items);
    if (!values.length) return;
    const hits = values.filter((item) => matchesItem(item, searchable));
    const misses = values.filter((item) => !hits.includes(item));
    dimensions.push({ label, matched: hits.length, total: values.length, weight, score: Math.round(hits.length / values.length * 100) });
    matched.push(...hits.map((item) => `${label}: ${item}`));
    missing.push(...misses.map((item) => `${label}: ${item}`));
  };
  addDimension('Capability', profile.capabilities, 45);
  addDimension('Search term', profile.preferred_keywords, 20);
  addDimension('Sector', profile.preferred_sectors, 15);
  addDimension('Target market', profile.preferred_countries, 10);
  addDimension('Buyer type', profile.preferred_buyer_types, 10);
  const weight = dimensions.reduce((total, item) => total + item.weight, 0);
  const fitScore = weight
    ? Math.round(dimensions.reduce((total, item) => total + item.score * item.weight, 0) / weight)
    : 0;
  if (!dimensions.some((item) => item.label === 'Capability' && item.matched > 0) || fitScore < 35) return null;
  const reason = matched.length
    ? `Profile alignment found: ${matched.slice(0, 5).join(', ')}.`
    : 'Some profile dimensions align with the captured notice.';
  return {
    fitScore,
    matched: [...new Set(matched)],
    missing,
    dimensions,
    reason: `${reason} This is not an eligibility decision or award prediction.`,
  };
}

function termsForProfile(profile) {
  const terms = profileItems([
    ...(profile.capabilities || []),
    ...(profile.preferred_keywords || []),
    ...(profile.preferred_sectors || []),
  ]).map((item) => item.replace(/[^a-z0-9\s-]/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 20);
  const groups = [];
  for (let index = 0; index < terms.length; index += 5) groups.push(terms.slice(index, index + 5));
  return groups;
}

async function recordRun(id, organizationId, fields) {
  await supabase(`discovery_runs?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}`, 'PATCH', fields);
}

async function processOrganization(organizationId, profile, ukResults, ukSearches, ukErrors, fromDate, now) {
  const runRows = await supabase('discovery_runs', 'POST', {
    organization_id: organizationId,
    status: 'running',
    sources_json: SOURCES.map((source) => source.name),
  });
  const runId = runRows?.[0]?.id;
  if (!runId) throw new Error(`Could not create discovery run for organization ${organizationId}.`);

  try {
    const sourceErrors = [...ukErrors];
    let searchesCount = ukSearches;
    const feedResults = [...ukResults];
    const terms = termsForProfile(profile);
    if (!terms.length) throw new Error('The saved profile has no usable capability or search terms.');
    try {
      const ted = await searchTed(terms, fromDate.toISOString().slice(0, 10).replace(/-/g, ''));
      feedResults.push(...ted.opportunities);
      searchesCount += ted.searchesCount;
      if (ted.errors.length) sourceErrors.push(`TED partial failure: ${ted.errors.join(' ')}`);
    } catch (error) {
      sourceErrors.push(`TED: ${error.message}`);
      console.error('TED public notices search failed.', error.message);
    }
    if (!searchesCount) throw new Error(sourceErrors.join(' ') || 'No procurement sources returned usable pages.');

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
      const organization = encodeURIComponent(`eq.${organizationId}`);
      const existing = await supabase(`opportunities?select=source_url&organization_id=${organization}&source_url=${filter}`);
      for (const row of existing || []) existingUrls.add(row.source_url);
    }

    const newCandidates = candidates.filter((candidate) => !existingUrls.has(candidate.sourceUrl));
    const records = newCandidates.map((candidate) => ({
      organization_id: organizationId,
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
        basis: 'Weighted keyword alignment to this organization profile; not an eligibility decision.',
        matched: candidate.fit.matched,
        missing: candidate.fit.missing,
        dimensions: candidate.fit.dimensions,
        review: [
          ...candidate.fit.missing.slice(0, 5).map((item) => `Profile preference not found in captured notice: ${item}.`),
          'Check whether the notice accepts suppliers based in your operating markets.',
          'Confirm mandatory registrations, qualification criteria and current deadline on the buyer notice.',
          'This profile-alignment score is not a supplier eligibility, compliance, or award prediction.',
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
    await recordRun(runId, organizationId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      searches_count: searchesCount,
      candidates_count: unique.size,
      added_count: added,
      error_message: warning,
    });
    await supabase('audit_log', 'POST', {
      organization_id: organizationId,
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
    console.info('Daily profile-based discovery completed.', {
      organizationId, searchesCount, candidates: unique.size, added, warning,
    });
    return { searchesCount, candidates: unique.size, added, warning };
  } catch (error) {
    await recordRun(runId, organizationId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error.message.slice(0, 500),
    });
    throw error;
  }
}

async function runDiscovery() {
  const organizations = await supabase('organizations?select=id&order=created_at.asc');
  const profiles = await supabase('organization_profiles?select=organization_id,profile_json');
  const profileByOrganization = new Map((profiles || []).map((row) => [row.organization_id, row.profile_json || {}]));
  const activeOrganizations = (organizations || []).filter((organization) =>
    profileByOrganization.get(organization.id)?.onboarding_complete === true);
  if (!activeOrganizations.length) {
    console.info('Daily public-source discovery skipped because no organization has completed its profile.');
    return { organizations: 0, searchesCount: 0, candidates: 0, added: 0 };
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  let ukResults = [];
  let ukSearches = 0;
  let ukErrors = [];
  try {
    const uk = await searchUkFeed(fromDate, now);
    ukResults = uk.opportunities;
    ukSearches = uk.searchesCount;
    ukErrors = uk.errors.map((error) => `UK Find a Tender partial failure: ${error}`);
  } catch (error) {
    ukErrors = [`UK Find a Tender: ${error.message}`];
    console.error('UK Find a Tender feed request failed.', error.message);
  }

  const results = [];
  const failures = [];
  for (const organization of activeOrganizations) {
    try {
      results.push(await processOrganization(
        organization.id,
        profileByOrganization.get(organization.id),
        ukResults,
        ukSearches,
        ukErrors,
        fromDate,
        now,
      ));
    } catch (error) {
      failures.push(`Organization ${organization.id}: ${error.message}`);
      console.error('Profile-based discovery failed for an organization.', organization.id, error.message);
    }
  }
  const totals = results.reduce((summary, result) => ({
    searchesCount: summary.searchesCount + result.searchesCount,
    candidates: summary.candidates + result.candidates,
    added: summary.added + result.added,
  }), { searchesCount: 0, candidates: 0, added: 0 });
  if (failures.length) console.error('One or more organization discovery runs failed.', failures);
  if (!results.length) throw new Error(failures.join(' '));
  return { organizations: results.length, ...totals, failures };
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
