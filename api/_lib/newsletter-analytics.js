/**
 * Newsletter Resend analytics — send records, webhook processing, edition stats.
 */
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase');

const WEBHOOK_TOLERANCE_SEC = 300;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function editionIdFromTags(tags) {
  const bag = tags && typeof tags === 'object' ? tags : {};
  const raw =
    bag.newsletter_edition_id ||
    bag.newsletterEditionId ||
    bag.edition_id ||
    bag.editionId ||
    '';
  const id = String(raw || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : '';
}

function verifySvixWebhook(rawBody, headers, webhookSecret) {
  const secret = String(webhookSecret || '').trim();
  if (!secret) return false;

  const msgId = headers['svix-id'] || headers['Svix-Id'];
  const timestamp = headers['svix-timestamp'] || headers['Svix-Timestamp'];
  const signatureHeader = headers['svix-signature'] || headers['Svix-Signature'];
  if (!msgId || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > WEBHOOK_TOLERANCE_SEC) return false;

  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const secretPart = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let secretBytes;
  try {
    secretBytes = Buffer.from(secretPart, 'base64');
  } catch {
    return false;
  }

  const signatures = String(signatureHeader).split(' ');
  for (const versioned of signatures) {
    const [version, signature] = String(versioned).split(',');
    if (version !== 'v1' || !signature) continue;
    const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      /* try next signature */
    }
  }
  return false;
}

async function recordNewsletterSend(sb, { editionId, recipientEmail, resendEmailId }) {
  const edition_id = String(editionId || '').trim();
  const recipient_email = normalizeEmail(recipientEmail);
  const resend_email_id = String(resendEmailId || '').trim() || null;
  if (!edition_id || !recipient_email) return null;

  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('newsletter_sends')
    .upsert(
      {
        edition_id,
        recipient_email,
        resend_email_id,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'edition_id,recipient_email' }
    )
    .select('*')
    .single();
  if (error) {
    if (/newsletter_sends/i.test(error.message || '') && /does not exist/i.test(error.message || '')) {
      return null;
    }
    throw new Error(error.message);
  }
  return data;
}

async function findSendRow(sb, { resendEmailId, editionId, recipientEmail }) {
  const client = sb || getSupabaseAdmin();
  const resend_email_id = String(resendEmailId || '').trim();
  if (resend_email_id) {
    const { data, error } = await client
      .from('newsletter_sends')
      .select('*')
      .eq('resend_email_id', resend_email_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const edition_id = String(editionId || '').trim();
  const recipient_email = normalizeEmail(recipientEmail);
  if (!edition_id || !recipient_email) return null;

  const { data, error } = await client
    .from('newsletter_sends')
    .select('*')
    .eq('edition_id', edition_id)
    .eq('recipient_email', recipient_email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function incrementLinkClick(sb, editionId, url) {
  const edition_id = String(editionId || '').trim();
  const link = String(url || '').trim();
  if (!edition_id || !link) return;

  const client = sb || getSupabaseAdmin();
  const { data: existing, error: selErr } = await client
    .from('newsletter_link_clicks')
    .select('id, click_count')
    .eq('edition_id', edition_id)
    .eq('url', link)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existing?.id) {
    const { error } = await client
      .from('newsletter_link_clicks')
      .update({ click_count: (Number(existing.click_count) || 0) + 1 })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from('newsletter_link_clicks').insert({
    edition_id,
    url: link,
    click_count: 1,
  });
  if (error) throw new Error(error.message);
}

async function markWebhookProcessed(sb, { eventId, eventType, resendEmailId, editionId }) {
  const client = sb || getSupabaseAdmin();
  const { error } = await client.from('newsletter_webhook_events').insert({
    id: String(eventId),
    event_type: String(eventType || ''),
    resend_email_id: resendEmailId || null,
    edition_id: editionId || null,
  });
  if (error && !/duplicate key|unique/i.test(error.message || '')) {
    throw new Error(error.message);
  }
  return !error;
}

async function wasWebhookProcessed(sb, eventId) {
  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('newsletter_webhook_events')
    .select('id')
    .eq('id', String(eventId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function applyOpenedEvent(sb, sendRow, at) {
  if (!sendRow?.id) return;
  const client = sb || getSupabaseAdmin();
  const when = at || new Date().toISOString();
  const patch = {
    open_count: (Number(sendRow.open_count) || 0) + 1,
  };
  if (!sendRow.first_opened_at) patch.first_opened_at = when;

  const { error } = await client.from('newsletter_sends').update(patch).eq('id', sendRow.id);
  if (error) throw new Error(error.message);
}

async function applyClickedEvent(sb, sendRow, click, at) {
  if (!sendRow?.id) return;
  const client = sb || getSupabaseAdmin();
  const when = at || new Date().toISOString();
  const patch = {
    click_count: (Number(sendRow.click_count) || 0) + 1,
  };
  if (!sendRow.first_clicked_at) patch.first_clicked_at = when;

  const { error } = await client.from('newsletter_sends').update(patch).eq('id', sendRow.id);
  if (error) throw new Error(error.message);

  const url = click?.link || click?.url || '';
  if (url) await incrementLinkClick(client, sendRow.edition_id, url);
}

async function applyDeliveredEvent(sb, sendRow, at) {
  if (!sendRow?.id || sendRow.delivered_at) return;
  const client = sb || getSupabaseAdmin();
  const { error } = await client
    .from('newsletter_sends')
    .update({ delivered_at: at || new Date().toISOString() })
    .eq('id', sendRow.id);
  if (error) throw new Error(error.message);
}

async function applyBouncedEvent(sb, sendRow, at) {
  if (!sendRow?.id || sendRow.bounced_at) return;
  const client = sb || getSupabaseAdmin();
  const { error } = await client
    .from('newsletter_sends')
    .update({ bounced_at: at || new Date().toISOString() })
    .eq('id', sendRow.id);
  if (error) throw new Error(error.message);
}

async function processResendWebhookEvent(sb, event, meta) {
  const client = sb || getSupabaseAdmin();
  const eventId = meta?.eventId || '';
  const eventType = String(event?.type || '').trim();
  const data = event?.data && typeof event.data === 'object' ? event.data : {};

  if (!eventType.startsWith('email.')) {
    return { skipped: true, reason: 'not_email_event' };
  }

  if (eventId && (await wasWebhookProcessed(client, eventId))) {
    return { skipped: true, reason: 'duplicate' };
  }

  const editionId = editionIdFromTags(data.tags);
  if (!editionId) {
    return { skipped: true, reason: 'not_newsletter' };
  }

  const resendEmailId = String(data.email_id || data.id || '').trim();
  const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;
  let sendRow = await findSendRow(client, {
    resendEmailId,
    editionId,
    recipientEmail,
  });

  if (!sendRow && resendEmailId && editionId && recipientEmail) {
    sendRow = await recordNewsletterSend(client, {
      editionId,
      recipientEmail,
      resendEmailId,
    });
  }

  if (!sendRow) {
    return { skipped: true, reason: 'send_not_found' };
  }

  if (resendEmailId && !sendRow.resend_email_id) {
    await client
      .from('newsletter_sends')
      .update({ resend_email_id: resendEmailId })
      .eq('id', sendRow.id);
    sendRow.resend_email_id = resendEmailId;
  }

  const at = event.created_at || data.created_at || new Date().toISOString();

  if (eventType === 'email.delivered') {
    await applyDeliveredEvent(client, sendRow, at);
  } else if (eventType === 'email.opened') {
    await applyOpenedEvent(client, sendRow, at);
  } else if (eventType === 'email.clicked') {
    await applyClickedEvent(client, sendRow, data.click, at);
  } else if (eventType === 'email.bounced' || eventType === 'email.failed') {
    await applyBouncedEvent(client, sendRow, at);
  } else {
    return { skipped: true, reason: 'unhandled_type', eventType };
  }

  if (eventId) {
    await markWebhookProcessed(client, {
      eventId,
      eventType,
      resendEmailId,
      editionId,
    });
  }

  return { ok: true, eventType, editionId };
}

function pct(numerator, denominator) {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}

async function getEditionAnalytics(sb, editionId) {
  const client = sb || getSupabaseAdmin();
  const edition_id = String(editionId || '').trim();
  if (!edition_id) return null;

  const [sendsRes, linksRes] = await Promise.all([
    client.from('newsletter_sends').select('*').eq('edition_id', edition_id),
    client
      .from('newsletter_link_clicks')
      .select('url, click_count')
      .eq('edition_id', edition_id)
      .order('click_count', { ascending: false })
      .limit(10),
  ]);

  if (sendsRes.error) {
    if (/newsletter_sends/i.test(sendsRes.error.message || '') && /does not exist/i.test(sendsRes.error.message || '')) {
      return { configured: false, schemaMissing: true };
    }
    throw new Error(sendsRes.error.message);
  }
  if (linksRes.error) throw new Error(linksRes.error.message);

  const sends = sendsRes.data || [];
  const tracked = sends.length;
  const delivered = sends.filter((row) => row.delivered_at).length;
  const uniqueOpens = sends.filter((row) => row.first_opened_at).length;
  const uniqueClicks = sends.filter((row) => row.first_clicked_at).length;
  const bounced = sends.filter((row) => row.bounced_at).length;
  const totalOpens = sends.reduce((sum, row) => sum + (Number(row.open_count) || 0), 0);
  const totalClicks = sends.reduce((sum, row) => sum + (Number(row.click_count) || 0), 0);

  return {
    configured: true,
    tracked,
    delivered,
    uniqueOpens,
    uniqueClicks,
    bounced,
    totalOpens,
    totalClicks,
    openRatePct: pct(uniqueOpens, tracked),
    clickRatePct: pct(uniqueClicks, tracked),
    clickToOpenRatePct: pct(uniqueClicks, uniqueOpens),
    topLinks: (linksRes.data || []).map((row) => ({
      url: row.url,
      clickCount: Number(row.click_count) || 0,
    })),
  };
}

function newsletterResendTags(editionId) {
  const id = String(editionId || '').trim();
  if (!id) return [];
  return [
    { name: 'newsletter_edition_id', value: id },
    { name: 'email_slug', value: 'hub_newsletter' },
  ];
}

module.exports = {
  verifySvixWebhook,
  recordNewsletterSend,
  processResendWebhookEvent,
  getEditionAnalytics,
  newsletterResendTags,
  editionIdFromTags,
};
