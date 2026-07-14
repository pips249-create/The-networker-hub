-- Fix featured expiry reminder email: CTA and pricing were two <td> in one <tr> (half-width layout).

update public.email_templates
set
  body_html = replace(
    body_html,
    '</tr><tr>
          <td class="mobile-pad email-cta" style="padding:0 40px 28px;text-align:center;"><a href="{{extend_url}}" style="display:inline-block;text-align:center;padding:14px 32px;background:#1c2040;border-radius:999px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;margin:0 6px 10px;">Extend featured listing &rarr;</a></td>
          <td class="mobile-pad" style="padding:0 40px 28px;text-align:center;"><p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;line-height:1.65;color:#635c5e;margin:0;">Extend for &pound;55 per month to keep your event in the Premium Spotlight carousel.</p></td>
        <tr>',
    '</tr><tr><td class="mobile-pad email-cta" style="padding:0 40px 12px;text-align:center;"><a href="{{extend_url}}" style="display:inline-block;text-align:center;padding:14px 32px;background:#1c2040;border-radius:999px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;margin:0 6px 10px;">Extend featured listing &rarr;</a></td></tr>
        <tr><td class="mobile-pad" style="padding:0 40px 28px;text-align:center;"><p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;line-height:1.65;color:#635c5e;margin:0;">Extend for &pound;55 per month to keep your event in the Premium Spotlight carousel.</p></td></tr>
        <tr>'
  ),
  updated_at = now()
where slug = 'organiser_featured_expiry_reminder'
  and body_html like '%Extend featured listing &rarr;</a></td>
          <td class="mobile-pad"%';
