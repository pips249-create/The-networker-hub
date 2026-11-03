#!/usr/bin/env node
/**
 * Upsert a TINA / Hubert Matchmaker seed batch into hubert_match_seed.
 *
 * Usage:
 *   node scripts/import-hubert-match-seed-batch.js [path/to/batch.json]
 *
 * Default batch: data/tina-seed-leeds-batch-2026-11.json
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in local.env or .env.
 *
 * Idempotent on email. Does not overwrite status = do_not_contact.
 * Phones go in notes only (never on public shortlist cards).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) {
  dotenv.config({ path: path.join(root, 'local.env') });
}
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { normalizeSeedInput, createSeedContact, updateSeedContact, listSeedContacts } =
  require('../api/_lib/hubert-match-seed');

const DEFAULT_BATCH = path.join(root, 'data', 'tina-seed-leeds-batch-2026-11.json');

function loadBatch(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.contacts) || !data.contacts.length) {
    throw new Error('batch JSON must include a non-empty contacts array');
  }
  return data;
}

function notesFor(contact, batch) {
  if (contact.notes && String(contact.notes).trim()) {
    return String(contact.notes).trim().slice(0, 1000);
  }
  const bits = [];
  if (batch.notesPrefix) bits.push(String(batch.notesPrefix).trim());
  if (contact.phone) bits.push('Phone: ' + String(contact.phone).trim());
  if (contact.location) bits.push('Location: ' + String(contact.location).trim());
  return bits.filter(Boolean).join(' · ').slice(0, 1000);
}

async function findByEmail(sb, email) {
  const { data, error } = await sb
    .from('hubert_match_seed')
    .select('id, status, email')
    .ilike('email', email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const filePath = path.resolve(process.argv[2] || DEFAULT_BATCH);
  const batch = loadBatch(filePath);
  const source = String(batch.source || 'rosie').trim() || 'rosie';
  const sb = getSupabaseAdmin();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const contact of batch.contacts) {
    const normalized = normalizeSeedInput(
      {
        fullName: contact.fullName || contact.name,
        email: contact.email,
        company: contact.company,
        industry: contact.industry,
        jobTitle: contact.jobTitle || contact.job_title || '',
        professionalRole: contact.professionalRole || contact.professional_role || '',
        lookingToMeet: contact.lookingToMeet || contact.looking_to_meet || [],
        linkedinUrl: contact.linkedinUrl || contact.linkedin_url || '',
        websiteUrl: contact.websiteUrl || contact.website_url || contact.companyPage || '',
        location: contact.location || '',
        country: contact.country || '',
        blurb: contact.blurb || '',
        notes: notesFor(contact, batch),
        source,
        status: 'active',
      },
      { partial: false }
    );

    if (!normalized.ok) {
      failed += 1;
      console.error('Invalid row:', contact.fullName || contact.email, normalized.errors);
      continue;
    }

    const email = normalized.fields.email;
    if (!email) {
      failed += 1;
      console.error('Missing email:', contact.fullName);
      continue;
    }

    try {
      const existing = await findByEmail(sb, email);
      if (existing) {
        if (existing.status === 'do_not_contact') {
          skipped += 1;
          console.log('skip do_not_contact:', email);
          continue;
        }
        await updateSeedContact(existing.id, {
          full_name: normalized.fields.full_name,
          company: normalized.fields.company,
          industry: normalized.fields.industry,
          job_title: normalized.fields.job_title,
          professional_role: normalized.fields.professional_role,
          linkedin_url: normalized.fields.linkedin_url,
          website_url: normalized.fields.website_url,
          location: normalized.fields.location,
          country: normalized.fields.country,
          blurb: normalized.fields.blurb,
          notes: normalized.fields.notes,
          source: normalized.fields.source,
        });
        updated += 1;
        console.log('updated:', email);
      } else {
        await createSeedContact(normalized.fields, null);
        created += 1;
        console.log('created:', email);
      }
    } catch (err) {
      failed += 1;
      console.error('Failed:', email, '—', err && err.message ? err.message : err);
    }
  }

  const listed = await listSeedContacts({ status: 'active', limit: 500 });
  console.log(
    JSON.stringify(
      {
        batch: batch.batch || path.basename(filePath),
        created,
        updated,
        skipped,
        failed,
        activeSeedTotal: listed.totals && listed.totals.active,
      },
      null,
      2
    )
  );

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
