/**
 * Newsletter edition persistence and scheduled sending.
 */
const { getSupabaseAdmin } = require('./supabase');
const { getEmailsEnabledForEmail } = require('./supabase-auth');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  NEWSLETTER_SLUG,
  mapEditionRow,
  editionToDbPatch,
  buildNewsletterVariables,
  parseEditionUuidList,
} = require('./newsletter-emails');

const SEND_BATCH_SIZE = 50;

function parseUuidList(raw) {
  return parseEditionUuidList(raw);
}

function wrapNewsletterDbError(error) {
  const msg = String(error?.message || error || '').trim();
  if (!msg) return new Error('Newsletter save failed');

  if (
    /newsletter_editions/i.test(msg) &&
    /does not exist|schema cache|could not find/i.test(msg)
  ) {
    const err = new Error(
      'Newsletter database tables are missing. Run Supabase migrations 089_hub_newsletter.sql and 090_newsletter_layout_and_article_image.sql.'
    );
    err.code = 'newsletter_schema_missing';
    return err;
  }

  if (/article_image_url|layout/i.test(msg) && /column/i.test(msg)) {
    const err = new Error(
      'Newsletter layout columns are missing. Run Supabase migration 090_newsletter_layout_and_article_image.sql.'
    );
    err.code = 'newsletter_schema_missing';
    return err;
  }

  if (/invalid input syntax for type uuid/i.test(msg)) {
    const err = new Error(
      'One or more featured listing IDs are not valid UUIDs. Leave those fields blank or paste IDs from the admin URLs.'
    );
    err.code = 'invalid_featured_ids';
    return err;
  }

  return new Error(msg);
}

async function listNewsletterEditions(sb) {
  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('newsletter_editions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []).map(mapEditionRow);
}

async function getNewsletterEdition(sb, id) {
  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('newsletter_editions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapEditionRow(data);
}

async function saveNewsletterEdition(sb, edition, { createdBy } = {}) {
  const client = sb || getSupabaseAdmin();
  const id = String(edition.id || '').trim();
  const patch = editionToDbPatch(edition);

  if (id) {
    const { data, error } = await client
      .from('newsletter_editions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw wrapNewsletterDbError(error);
    return mapEditionRow(data);
  }

  const { data, error } = await client
    .from('newsletter_editions')
    .insert({
      ...patch,
      status: 'draft',
      created_by: String(createdBy || '').trim(),
    })
    .select('*')
    .single();
  if (error) throw wrapNewsletterDbError(error);
  return mapEditionRow(data);
}

async function scheduleNewsletterEdition(sb, id, scheduledAt) {
  const client = sb || getSupabaseAdmin();
  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime())) {
    const err = new Error('invalid_scheduled_at');
    err.code = 'invalid_scheduled_at';
    throw err;
  }

  const { data, error } = await client
    .from('newsletter_editions')
    .update({
      status: 'scheduled',
      scheduled_at: when.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['draft', 'scheduled'])
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapEditionRow(data);
}

async function cancelNewsletterEdition(sb, id) {
  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('newsletter_editions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['draft', 'scheduled', 'sending'])
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapEditionRow(data);
}

async function duplicateNewsletterEdition(sb, id, { createdBy } = {}) {
  const client = sb || getSupabaseAdmin();
  const source = await getNewsletterEdition(client, id);
  if (!source) {
    const err = new Error('not_found');
    err.code = 'not_found';
    throw err;
  }

  const patch = editionToDbPatch({
    editionLabel: source.editionLabel + ' (copy)',
    subject: source.subject,
    preheader: source.preheader,
    articleTitle: source.articleTitle,
    articleBody: source.articleBody,
    articleImageUrl: source.articleImageUrl,
    layout: source.layout,
    hubNews: source.hubNews,
    memberSpotlightName: source.memberSpotlightName,
    memberSpotlightTitle: source.memberSpotlightTitle,
    memberSpotlightBody: source.memberSpotlightBody,
    memberSpotlightImageUrl: source.memberSpotlightImageUrl,
    autoFeatured: source.autoFeatured,
    useEventsSponsor: source.useEventsSponsor,
    featuredEventIds: source.featuredEventIds,
    featuredOrganiserIds: source.featuredOrganiserIds,
    featuredOpportunityIds: source.featuredOpportunityIds,
  });

  const { data, error } = await client
    .from('newsletter_editions')
    .insert({
      ...patch,
      status: 'draft',
      created_by: String(createdBy || source.createdBy || '').trim(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapEditionRow(data);
}

async function listNewsletterRecipients(sb) {
  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('attendees')
    .select('id, email, name')
    .not('email', 'is', null);
  if (error) throw new Error(error.message);

  const byEmail = new Map();
  (data || []).forEach((row) => {
    const email = String(row.email || '')
      .trim()
      .toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        id: row.id,
        email,
        name: String(row.name || '').trim(),
      });
    }
  });

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

async function previewNewsletterEdition(sb, edition, recipient) {
  const client = sb || getSupabaseAdmin();
  const vars = await buildNewsletterVariables(client, edition, recipient || { name: 'Alex Morgan' });
  const { buildEmailFromTemplate } = require('./send-template-email');
  const subject = String(edition.subject || edition.edition_label || vars.edition_label).trim();
  return await buildEmailFromTemplate(NEWSLETTER_SLUG, {
    ...vars,
    newsletter_subject: subject,
  });
}

async function sendNewsletterTest(sb, edition, toEmail) {
  const client = sb || getSupabaseAdmin();
  const email = String(toEmail || '')
    .trim()
    .toLowerCase();
  if (!email) {
    const err = new Error('missing_recipient');
    err.code = 'missing_recipient';
    throw err;
  }

  const vars = await buildNewsletterVariables(client, edition, {
    name: email.split('@')[0],
    email,
  });
  const subject = String(edition.subject || edition.edition_label || vars.edition_label).trim();

  try {
    return await sendTemplatedEmail({
      slug: NEWSLETTER_SLUG,
      to: email,
      variables: { ...vars, newsletter_subject: subject },
      skipEmailCheck: true,
      subject: vars.edition_label + ' — ' + subject,
    });
  } catch (e) {
    if (!e.code && /template_not_found/i.test(e.message || '')) {
      e.code = 'template_not_found';
    }
    throw e;
  }
}

async function beginNewsletterSend(sb, editionRow) {
  const client = sb || getSupabaseAdmin();
  const recipients = await listNewsletterRecipients(client);
  const { data, error } = await client
    .from('newsletter_editions')
    .update({
      status: 'sending',
      recipient_count: recipients.length,
      send_cursor: 0,
      sent_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editionRow.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { edition: mapEditionRow(data), recipients };
}

async function processNewsletterSendBatch(sb, editionId) {
  const client = sb || getSupabaseAdmin();
  const edition = await getNewsletterEdition(client, editionId);
  if (!edition) return { skipped: true, reason: 'not_found' };

  let row = edition;
  let recipients = await listNewsletterRecipients(client);

  if (row.status === 'scheduled') {
    const started = await beginNewsletterSend(client, { id: editionId });
    row = started.edition;
    recipients = started.recipients;
  }

  if (row.status !== 'sending') {
    return { skipped: true, reason: 'not_sending', status: row.status };
  }

  const cursor = Number(row.sendCursor) || 0;
  const batch = recipients.slice(cursor, cursor + SEND_BATCH_SIZE);
  if (!batch.length) {
    const { data, error } = await client
      .from('newsletter_editions')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', editionId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { completed: true, edition: mapEditionRow(data) };
  }

  const subject = String(row.subject || row.editionLabel).trim();
  let sent = 0;
  let failed = 0;
  const errors = [];

  const { data: rawEdition } = await client
    .from('newsletter_editions')
    .select('*')
    .eq('id', editionId)
    .maybeSingle();

  for (const recipient of batch) {
    try {
      const allowed = await getEmailsEnabledForEmail(recipient.email);
      if (!allowed) continue;

      const vars = await buildNewsletterVariables(client, rawEdition, recipient);
      await sendTemplatedEmail({
        slug: NEWSLETTER_SLUG,
        to: recipient.email,
        variables: { ...vars, newsletter_subject: subject },
        subject: vars.edition_label + ' — ' + subject,
      });
      sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') continue;
      failed += 1;
      errors.push({ email: recipient.email, message: e.message || String(e) });
    }
  }

  const newCursor = cursor + batch.length;
  const { data: updated, error: updErr } = await client
    .from('newsletter_editions')
    .update({
      send_cursor: newCursor,
      sent_count: (Number(row.sentCount) || 0) + sent,
      failed_count: (Number(row.failedCount) || 0) + failed,
      status: newCursor >= recipients.length ? 'sent' : 'sending',
      sent_at: newCursor >= recipients.length ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editionId)
    .select('*')
    .single();
  if (updErr) throw new Error(updErr.message);

  return {
    edition: mapEditionRow(updated),
    batchSent: sent,
    batchFailed: failed,
    errors,
    completed: newCursor >= recipients.length,
  };
}

async function runNewsletterSendMaintenance(sb) {
  const client = sb || getSupabaseAdmin();
  const now = new Date().toISOString();

  const [scheduledRes, sendingRes] = await Promise.all([
    client
      .from('newsletter_editions')
      .select('id, status, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now),
    client.from('newsletter_editions').select('id, status').eq('status', 'sending'),
  ]);
  if (scheduledRes.error) throw new Error(scheduledRes.error.message);
  if (sendingRes.error) throw new Error(sendingRes.error.message);

  const seen = new Set();
  const due = [];
  [...(scheduledRes.data || []), ...(sendingRes.data || [])].forEach((row) => {
    if (!row?.id || seen.has(row.id)) return;
    seen.add(row.id);
    due.push(row);
  });

  const result = { processed: 0, editions: [] };
  for (const row of due || []) {
    if (row.status === 'scheduled') {
      const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null;
      if (!scheduled || scheduled > new Date()) continue;
    }
    const batchResult = await processNewsletterSendBatch(client, row.id);
    result.processed += 1;
    result.editions.push({ id: row.id, ...batchResult });
  }
  return result;
}

module.exports = {
  parseUuidList,
  listNewsletterEditions,
  getNewsletterEdition,
  saveNewsletterEdition,
  scheduleNewsletterEdition,
  cancelNewsletterEdition,
  duplicateNewsletterEdition,
  listNewsletterRecipients,
  previewNewsletterEdition,
  sendNewsletterTest,
  processNewsletterSendBatch,
  runNewsletterSendMaintenance,
};
