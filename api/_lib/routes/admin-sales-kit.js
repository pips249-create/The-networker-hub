/**
 * Command Centre — Organiser sales kit helpers.
 * GET  /api/admin/sales-kit
 * POST /api/admin/sales-kit  { action, ... }
 */
const { json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { publicOrganiserSlug } = require('../organiser-slug');
const { applyIlikeSearch } = require('../search-match');
const { shownByFromEmail } = require('../organiser-sales-outreach');
const {
  SECTION_CATALOG,
  DEFAULT_SECTIONS,
  makeDeckSlug,
  normalizeSections,
  normalizeWebsite,
  cleanText,
  generateCustomPitchDeck,
  publicPathForSlug,
  validatePitchDeckInput,
} = require('../custom-pitch-deck-generate');
const {
  SPONSORSHIP_PLACEMENT_CATALOG,
  SPONSORSHIP_PLACEMENT_ORDER,
  normalizeDeckType,
  normalizeSponsorshipPlacements,
} = require('../sponsorship-pitch-catalog');

const SHOWN_BY = new Set(['Catherine', 'Rosie', 'Jamie', 'Other']);
const OUTCOMES = new Set(['interested', 'listed', 'follow_up', 'not_now', 'other']);

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function mapOrganiser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: String(row.name || '').trim() || 'Untitled',
    slug: publicOrganiserSlug(row) || '',
    email: String(row.contact_email || row.email || '')
      .trim()
      .toLowerCase(),
    website: String(row.website || '').trim(),
    photoUrl: String(row.photo_url || '').trim(),
    isInternal: Boolean(row.is_internal),
    isWalkthroughDemo: Boolean(row.is_walkthrough_demo),
  };
}

function mapCustomPitchDeck(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    path: publicPathForSlug(row.slug),
    companyName: row.company_name,
    website: row.website || '',
    contactName: row.contact_name || '',
    organiserId: row.organiser_id || null,
    prospectLogoUrl: row.prospect_logo_url || '',
    deckType: row.deck_type || 'organiser',
    sponsorshipPlacements: row.sponsorship_placements || [],
    includeSections: row.include_sections || [],
    brief: row.brief || '',
    createdByEmail: row.created_by_email || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function absoluteDeckUrl(slug) {
  return 'https://www.thenetworkeruk.com' + publicPathForSlug(slug);
}

function pitchDeckCrmNotes(deckUrl, isUpdate) {
  const verb = isUpdate ? 'Updated tailored pitch deck' : 'Tailored pitch deck';
  return 'Meeting — ' + verb + ': ' + deckUrl;
}

function truthyLogToCrm(raw) {
  if (raw === false || raw === 0) return false;
  const s = String(raw == null ? 'true' : raw)
    .trim()
    .toLowerCase();
  return s !== 'false' && s !== '0' && s !== 'no';
}

function descriptionSnippet(description) {
  const text = String(description || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.length <= 480) return text;
  return text.slice(0, 477) + '…';
}

async function getFocusOrganiserProfile(sb, organiserId) {
  const id = String(organiserId || '').trim();
  if (!id) return null;
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, description')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const mapped = mapOrganiser(data);
  return {
    ...mapped,
    description: String(data.description || '').trim(),
    descriptionSnippet: descriptionSnippet(data.description),
  };
}

function migrationHintFromDbError(msg) {
  const m = String(msg || '').trim();
  if (/custom_pitch_decks|deck_type|sponsorship_placements|prospect_logo_url/i.test(m)) {
    return (
      'Run migrations 293_custom_pitch_decks.sql, 294_custom_pitch_decks_logo.sql, and ' +
      '295_custom_pitch_decks_sponsorship.sql in Supabase, then reload the API schema.'
    );
  }
  if (/organiser_sales_demos|is_walkthrough_demo/i.test(m)) {
    return (
      'Run migrations 252_organiser_sales_kit.sql and 253_organiser_sales_kit_source.sql in Supabase, then reload the API schema.'
    );
  }
  if (/schema cache/i.test(m)) {
    return 'Supabase schema cache is stale — Project Settings → API → Reload schema, then refresh this page.';
  }
  if (/does not exist/i.test(m)) {
    return (
      'Database table or column missing. Confirm migrations 252, 253, 293–295 are applied, reload schema. (' +
      m.slice(0, 160) +
      ')'
    );
  }
  return m || 'Could not save';
}

async function logPitchDeckToCrm(sb, req, fields) {
  const actor = actorFromRequest(req);
  if (!SHOWN_BY.has(actor.shownBy)) return null;
  const organiserName = cleanText(fields.organiserName, 200);
  if (!organiserName) return null;

  const row = {
    shown_at: new Date().toISOString().slice(0, 10),
    shown_by: actor.shownBy,
    organiser_name: organiserName,
    organiser_email: fields.organiserEmail || null,
    organiser_id: fields.organiserId || null,
    outcome: 'follow_up',
    notes: fields.notes || null,
    source: 'manual',
    created_by_email: actor.email || sessionEmail(req) || null,
  };

  let insertRes = await sb
    .from('organiser_sales_demos')
    .insert(row)
    .select(
      'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
    )
    .maybeSingle();
  if (insertRes.error && /source/i.test(String(insertRes.error.message || ''))) {
    const legacyRow = { ...row };
    delete legacyRow.source;
    insertRes = await sb
      .from('organiser_sales_demos')
      .insert(legacyRow)
      .select(
        'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, created_by_email, created_at, updated_at'
      )
      .maybeSingle();
  }
  if (insertRes.error) throw new Error(insertRes.error.message);
  return mapDemo(insertRes.data);
}

async function tryLogPitchDeckToCrm(sb, req, fields) {
  try {
    const demo = await logPitchDeckToCrm(sb, req, fields);
    return { demo, warning: null };
  } catch (e) {
    const warning = migrationHintFromDbError(e && e.message);
    console.warn('sales-kit CRM log failed', e && e.message);
    return { demo: null, warning };
  }
}

function parsePitchDeckBody(body) {
  const companyName = cleanText(body.companyName || body.company_name, 120);
  const website = normalizeWebsite(body.website);
  const contactName = cleanText(body.contactName || body.contact_name, 120);
  const brief = cleanText(body.brief || body.includes || body.contentBrief, 4000);
  const includeSections = normalizeSections(body.includeSections || body.include_sections);
  const organiserId = String(body.organiserId || body.organiser_id || '').trim() || null;
  const organiserEmail = String(body.organiserEmail || body.organiser_email || '')
    .trim()
    .toLowerCase();
  const prospectLogoUrl = cleanText(body.prospectLogoUrl || body.prospect_logo_url, 2000);
  const deckType = normalizeDeckType(body.deckType || body.deck_type);
  const sponsorshipPlacements = normalizeSponsorshipPlacements(
    body.sponsorshipPlacements || body.sponsorship_placements
  );
  return {
    companyName,
    website,
    contactName,
    brief,
    includeSections,
    organiserId,
    organiserEmail,
    prospectLogoUrl,
    deckType,
    sponsorshipPlacements,
  };
}

async function listCustomPitchDecks(sb) {
  const { data, error } = await sb
    .from('custom_pitch_decks')
    .select(
      'id, slug, company_name, website, contact_name, organiser_id, prospect_logo_url, deck_type, sponsorship_placements, include_sections, brief, created_by_email, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []).map(mapCustomPitchDeck);
}

function mapDemo(row) {
  return {
    id: row.id,
    shownAt: row.shown_at,
    shownBy: row.shown_by,
    organiserName: row.organiser_name,
    organiserEmail: row.organiser_email || '',
    organiserId: row.organiser_id || null,
    outcome: row.outcome || 'follow_up',
    notes: row.notes || '',
    source: row.source || 'manual',
    createdByEmail: row.created_by_email || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDemoOrganiser(sb) {
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo')
    .eq('is_walkthrough_demo', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapOrganiser(data);
}

async function listInternalCandidates(sb) {
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo')
    .eq('is_internal', true)
    .order('name', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(mapOrganiser);
}

async function searchOrganisers(sb, q) {
  let query = sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo')
    .order('name', { ascending: true })
    .limit(20);
  query = applyIlikeSearch(query, q, ['name', 'email', 'contact_email', 'slug']);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(mapOrganiser);
}

async function listDemos(sb) {
  let query = sb
    .from('organiser_sales_demos')
    .select(
      'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
    )
    .order('shown_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  let { data, error } = await query;
  if (error && /source/i.test(String(error.message || ''))) {
    const retry = await sb
      .from('organiser_sales_demos')
      .select(
        'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, created_by_email, created_at, updated_at'
      )
      .order('shown_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return (data || []).map(mapDemo);
}

function sessionEmail(req) {
  const session = sessionFromRequest(req);
  return String((session && session.email) || '')
    .trim()
    .toLowerCase();
}

function actorFromRequest(req) {
  const email = sessionEmail(req);
  return {
    email,
    shownBy: shownByFromEmail(email),
  };
}

module.exports = async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const q = String(req.query?.q || '').trim();
      const focusOrganiserId = String(req.query?.organiser || req.query?.organiserId || '').trim();
      const [demoOrganiser, internalCandidates, demos, customPitchDecks, focusOrganiserProfile] =
        await Promise.all([
          getDemoOrganiser(sb),
          listInternalCandidates(sb),
          listDemos(sb),
          listCustomPitchDecks(sb).catch(function (e) {
            const msg = e && e.message ? String(e.message) : '';
            if (/custom_pitch_decks|does not exist|schema cache/i.test(msg)) return [];
            throw e;
          }),
          focusOrganiserId ? getFocusOrganiserProfile(sb, focusOrganiserId) : Promise.resolve(null),
        ]);
      const search = q ? await searchOrganisers(sb, q) : [];
      return json(res, 200, {
        ok: true,
        demoOrganiser,
        internalCandidates,
        demos,
        customPitchDecks,
        focusOrganiserProfile,
        pitchSectionCatalog: SECTION_CATALOG,
        pitchDefaultSections: DEFAULT_SECTIONS,
        pitchSponsorshipCatalog: SPONSORSHIP_PLACEMENT_CATALOG,
        pitchSponsorshipOrder: SPONSORSHIP_PLACEMENT_ORDER,
        search,
        actor: actorFromRequest(req),
        migrationHint:
          'If this page errors about missing columns/tables, run supabase/migrations/252_organiser_sales_kit.sql and 293_custom_pitch_decks.sql in Supabase.',
      });
    } catch (e) {
      console.error('admin-sales-kit GET', e);
      const msg = e && e.message ? String(e.message) : 'Could not load sales kit';
      const missing =
        /is_walkthrough_demo|organiser_sales_demos|does not exist|schema cache/i.test(msg);
      return json(res, missing ? 503 : 500, {
        ok: false,
        error: missing ? 'migration_required' : 'load_failed',
        message: missing ? migrationHintFromDbError(msg) : msg,
      });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const action = String(body.action || '').trim();

  try {
    if (action === 'set_demo_organiser') {
      const organiserId = String(body.organiserId || body.organiser_id || '').trim();
      if (!organiserId) {
        return json(res, 400, { error: 'missing_organiser_id', message: 'Pick a group first.' });
      }
      const { data: existing, error: getErr } = await sb
        .from('organisers')
        .select('id')
        .eq('id', organiserId)
        .maybeSingle();
      if (getErr) throw new Error(getErr.message);
      if (!existing) {
        return json(res, 404, { error: 'not_found', message: 'Group not found.' });
      }
      const clearRes = await sb
        .from('organisers')
        .update({ is_walkthrough_demo: false })
        .eq('is_walkthrough_demo', true);
      if (clearRes.error) throw new Error(clearRes.error.message);
      const setRes = await sb
        .from('organisers')
        .update({ is_walkthrough_demo: true, is_internal: true })
        .eq('id', organiserId)
        .select(
          'id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo'
        )
        .maybeSingle();
      if (setRes.error) throw new Error(setRes.error.message);
      return json(res, 200, { ok: true, demoOrganiser: mapOrganiser(setRes.data) });
    }

    if (action === 'clear_demo_organiser') {
      const clearRes = await sb
        .from('organisers')
        .update({ is_walkthrough_demo: false })
        .eq('is_walkthrough_demo', true);
      if (clearRes.error) throw new Error(clearRes.error.message);
      return json(res, 200, { ok: true, demoOrganiser: null });
    }

    if (action === 'add_demo') {
      const actor = actorFromRequest(req);
      const shownBy = actor.shownBy;
      const organiserName = String(body.organiserName || '').trim();
      const organiserEmail = String(body.organiserEmail || '')
        .trim()
        .toLowerCase();
      const organiserId = String(body.organiserId || '').trim() || null;
      const outcome = String(body.outcome || 'follow_up').trim();
      const notes = String(body.notes || '').trim();
      const shownAt = String(body.shownAt || '').trim() || new Date().toISOString().slice(0, 10);

      if (!SHOWN_BY.has(shownBy)) {
        return json(res, 400, {
          error: 'invalid_shown_by',
          message: 'Your login is not mapped to a sales-kit user.',
        });
      }
      if (!organiserName) {
        return json(res, 400, { error: 'missing_name', message: 'Add the group or contact name.' });
      }
      if (!OUTCOMES.has(outcome)) {
        return json(res, 400, { error: 'invalid_outcome', message: 'Pick a valid outcome.' });
      }

      const insertRes = await sb
        .from('organiser_sales_demos')
        .insert({
          shown_at: shownAt,
          shown_by: shownBy,
          organiser_name: organiserName,
          organiser_email: organiserEmail || null,
          organiser_id: organiserId,
          outcome,
          notes: notes || null,
          source: 'manual',
          created_by_email: actor.email || sessionEmail(req) || null,
        })
        .select(
          'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
        )
        .maybeSingle();
      if (insertRes.error) throw new Error(insertRes.error.message);
      return json(res, 200, { ok: true, demo: mapDemo(insertRes.data) });
    }

    if (action === 'update_demo') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'missing_id' });
      const patch = { updated_at: new Date().toISOString() };
      if (body.organiserName != null) {
        const name = String(body.organiserName).trim();
        if (!name) return json(res, 400, { error: 'missing_name' });
        patch.organiser_name = name;
      }
      if (body.organiserEmail != null) {
        patch.organiser_email = String(body.organiserEmail).trim().toLowerCase() || null;
      }
      if (body.outcome != null) {
        const outcome = String(body.outcome).trim();
        if (!OUTCOMES.has(outcome)) return json(res, 400, { error: 'invalid_outcome' });
        patch.outcome = outcome;
      }
      if (body.notes != null) patch.notes = String(body.notes).trim() || null;
      if (body.shownAt != null) patch.shown_at = String(body.shownAt).trim();

      const upd = await sb
        .from('organiser_sales_demos')
        .update(patch)
        .eq('id', id)
        .select(
          'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
        )
        .maybeSingle();
      if (upd.error) throw new Error(upd.error.message);
      if (!upd.data) return json(res, 404, { error: 'not_found' });
      return json(res, 200, { ok: true, demo: mapDemo(upd.data) });
    }

    if (action === 'delete_demo') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'missing_id' });
      const del = await sb.from('organiser_sales_demos').delete().eq('id', id);
      if (del.error) throw new Error(del.error.message);
      return json(res, 200, { ok: true });
    }

    if (action === 'create_custom_pitch_deck' || action === 'update_custom_pitch_deck') {
      const parsed = parsePitchDeckBody(body);
      const companyName = parsed.companyName;
      if (!companyName) {
        return json(res, 400, { error: 'missing_company', message: 'Add the company or group name.' });
      }

      const validation = validatePitchDeckInput(parsed);
      if (!validation.ok) {
        return json(res, 400, { error: 'missing_placements', message: validation.message });
      }

      const deck = await generateCustomPitchDeck({
        companyName,
        website: parsed.website,
        brief: parsed.brief,
        includeSections: parsed.includeSections,
        prospectLogoUrl: parsed.prospectLogoUrl,
        deckType: parsed.deckType,
        sponsorshipPlacements: parsed.sponsorshipPlacements,
      });

      const logToCrm = truthyLogToCrm(body.logToCrm);
      const isUpdate = action === 'update_custom_pitch_deck';
      const deckId = String(body.id || body.deckId || '').trim();

      if (isUpdate) {
        if (!deckId) return json(res, 400, { error: 'missing_id', message: 'Pick a deck to update.' });
        const upd = await sb
          .from('custom_pitch_decks')
          .update({
            company_name: companyName,
            website: parsed.website || null,
            contact_name: parsed.contactName || null,
            organiser_id: parsed.organiserId,
            prospect_logo_url: parsed.prospectLogoUrl || null,
            deck_type: parsed.deckType,
            sponsorship_placements: parsed.sponsorshipPlacements,
            include_sections: parsed.includeSections,
            brief: parsed.brief || null,
            deck,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deckId)
          .select(
            'id, slug, company_name, website, contact_name, organiser_id, prospect_logo_url, deck_type, sponsorship_placements, include_sections, brief, created_by_email, created_at, updated_at'
          )
          .maybeSingle();
        if (upd.error) throw new Error(upd.error.message);
        if (!upd.data) return json(res, 404, { error: 'not_found', message: 'Deck not found.' });

        let crmDemo = null;
        let crmWarning = null;
        if (logToCrm) {
          const crm = await tryLogPitchDeckToCrm(sb, req, {
            organiserName: companyName,
            organiserEmail: parsed.organiserEmail || null,
            organiserId: parsed.organiserId,
            notes: pitchDeckCrmNotes(absoluteDeckUrl(upd.data.slug), true),
          });
          crmDemo = crm.demo;
          crmWarning = crm.warning;
        }

        return json(res, 200, {
          ok: true,
          deck: mapCustomPitchDeck(upd.data),
          generatedDeck: deck,
          crmDemo,
          crmWarning,
        });
      }

      let slug = makeDeckSlug(companyName);
      for (let attempt = 0; attempt < 5; attempt++) {
        const insertRes = await sb
          .from('custom_pitch_decks')
          .insert({
            slug,
            company_name: companyName,
            website: parsed.website || null,
            contact_name: parsed.contactName || null,
            organiser_id: parsed.organiserId,
            prospect_logo_url: parsed.prospectLogoUrl || null,
            deck_type: parsed.deckType,
            sponsorship_placements: parsed.sponsorshipPlacements,
            include_sections: parsed.includeSections,
            brief: parsed.brief || null,
            deck,
            created_by_email: sessionEmail(req) || null,
          })
          .select(
            'id, slug, company_name, website, contact_name, organiser_id, prospect_logo_url, deck_type, sponsorship_placements, include_sections, brief, created_by_email, created_at, updated_at'
          )
          .maybeSingle();
        if (!insertRes.error) {
          let crmDemo = null;
          let crmWarning = null;
          if (logToCrm) {
            const crm = await tryLogPitchDeckToCrm(sb, req, {
              organiserName: companyName,
              organiserEmail: parsed.organiserEmail || null,
              organiserId: parsed.organiserId,
              notes: pitchDeckCrmNotes(absoluteDeckUrl(insertRes.data.slug), false),
            });
            crmDemo = crm.demo;
            crmWarning = crm.warning;
          }
          return json(res, 200, {
            ok: true,
            deck: mapCustomPitchDeck(insertRes.data),
            generatedDeck: deck,
            crmDemo,
            crmWarning,
          });
        }
        if (/duplicate|unique/i.test(String(insertRes.error.message || ''))) {
          slug = makeDeckSlug(companyName);
          continue;
        }
        throw new Error(insertRes.error.message);
      }
      return json(res, 500, { error: 'slug_collision', message: 'Could not allocate a deck URL — try again.' });
    }

    if (action === 'delete_custom_pitch_deck') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'missing_id' });
      const del = await sb.from('custom_pitch_decks').delete().eq('id', id);
      if (del.error) throw new Error(del.error.message);
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: 'unknown_action', message: 'Unknown sales-kit action.' });
  } catch (e) {
    console.error('admin-sales-kit POST', e);
    const msg = e && e.message ? String(e.message) : 'Could not save';
    const missing =
      /is_walkthrough_demo|organiser_sales_demos|custom_pitch_decks|deck_type|sponsorship_placements|does not exist|schema cache/i.test(
        msg
      );
    return json(res, missing ? 503 : 500, {
      ok: false,
      error: missing ? 'migration_required' : 'save_failed',
      message: missing ? migrationHintFromDbError(msg) : msg,
    });
  }
};
