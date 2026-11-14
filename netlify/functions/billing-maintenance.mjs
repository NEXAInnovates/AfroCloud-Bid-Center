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
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    console.error('NEXA billing maintenance database request failed.', response.status, data?.code || data?.message || 'Supabase error');
    throw new Error(`Billing maintenance database request failed (${response.status}).`);
  }
  return data;
}

async function sendReminder(email, name, plan, days, organizationId, isTrial) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NEXA_EMAIL_FROM;
  if (!key || !from) return false;
  const siteUrl = (process.env.NEXA_SITE_URL || 'https://nexa-innovates.com').replace(/\/+$/, '');
  const when = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: isTrial ? `Your NEXA BidOps trial ends ${when}` : `Your NEXA BidOps subscription renews ${when}`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Your NEXA BidOps ${isTrial ? "free trial ends" : "subscription period ends"} ${when}. Review your plan and payment details to keep workspace access.</p><p>Current plan: ${escapeHtml(plan)}.</p><p><a href="${escapeHtml(siteUrl)}/">Review your plan and billing</a></p><p>If you have already paid, no action is needed while payment confirmation completes.</p>`,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const raw = await response.text();
    console.error('NEXA trial reminder email failed.', response.status, raw.slice(0, 250));
    throw new Error(`Reminder email was rejected (${response.status}).`);
  }
  return true;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function processSubscription(subscription, now) {
  const isTrial = subscription.status === 'trialing';
  const expiresAt = isTrial ? subscription.trial_ends_at : subscription.current_period_end;
  if (!expiresAt) return { reminded: false, expired: false };
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) throw new Error(`Subscription has an invalid end date for ${subscription.organization_id}.`);
  const days = Math.ceil((end - now.getTime()) / 86400000);
  if (days < 0 || days > 3 || subscription.last_reminder_day === days) {
    if (days < 0) await expire(subscription);
    return { reminded: false, expired: days <= 0 };
  }

  const owners = await supabase(`bid_users?select=email,display_name&organization_id=eq.${encodeURIComponent(subscription.organization_id)}&role=eq.owner&active=eq.true&limit=1`);
  const owner = owners?.[0];
  let reminded = false;
  if (owner?.email) {
    reminded = await sendReminder(owner.email, owner.display_name, subscription.plan, days, subscription.organization_id, isTrial);
    if (reminded) {
      await supabase(`subscriptions?organization_id=eq.${encodeURIComponent(subscription.organization_id)}&status=eq.${encodeURIComponent(subscription.status)}`, 'PATCH', {
        last_reminder_day: days,
      });
    }
  }
  if (days <= 0) await expire(subscription);
  return { reminded, expired: days <= 0 };
}

async function expire(subscription) {
  const nextStatus = subscription.status === 'trialing' ? 'expired' : 'past_due';
  const updated = await supabase(
    `subscriptions?organization_id=eq.${encodeURIComponent(subscription.organization_id)}&status=eq.${encodeURIComponent(subscription.status)}`,
    'PATCH',
    { status: nextStatus, expired_at: new Date().toISOString() },
  );
  if (Array.isArray(updated) && updated.length) {
    await supabase('subscription_events', 'POST', {
      organization_id: subscription.organization_id,
      event_type: subscription.status === 'trialing' ? 'trial_expired' : 'subscription_period_ended',
      from_status: subscription.status,
      to_status: nextStatus,
      plan: subscription.plan,
      detail_json: { period_ends_at: subscription.status === 'trialing' ? subscription.trial_ends_at : subscription.current_period_end },
    });
    console.info('NEXA subscription ended; workspace access is paused until renewal.', subscription.organization_id);
  }
}

async function run() {
  const subscriptions = await supabase('subscriptions?select=organization_id,plan,status,trial_ends_at,current_period_end,last_reminder_day&status=in.(trialing,active)&order=trial_ends_at.asc');
  const now = new Date();
  const summary = { checked: (subscriptions || []).length, reminded: 0, expired: 0, errors: [] };
  for (const subscription of subscriptions || []) {
    try {
      const result = await processSubscription(subscription, now);
      if (result.reminded) summary.reminded += 1;
      if (result.expired) summary.expired += 1;
    } catch (error) {
      summary.errors.push(`${subscription.organization_id}: ${error.message}`);
      console.error('NEXA trial maintenance failed for one organization.', subscription.organization_id, error.message);
    }
  }
  if (summary.errors.length) console.error('Some trial reminders or expirations were not completed.', summary.errors);
  console.info('NEXA billing maintenance finished.', summary);
  return summary;
}

export default async function handler() {
  try {
    const summary = await run();
    return new Response(JSON.stringify(summary), {
      status: summary.errors.length ? 500 : 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('NEXA billing maintenance failed.', error.message);
    return new Response('NEXA billing maintenance failed. Check function logs and required environment variables.', { status: 500 });
  }
}

export const config = { schedule: '@daily' };
