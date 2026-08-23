/**
 * Shared responsive rules for Hub HTML emails (hub-email-layout-v2 and booking templates).
 */
const EMAIL_MOBILE_MEDIA_CSS = `    @media only screen and (max-width:600px) {
      .email-outer-pad { padding:8px 0 !important; }
      .email-wrapper {
        width:100% !important;
        max-width:100% !important;
        border-radius:0 !important;
        box-shadow:none !important;
        overflow:visible !important;
      }
      .hero-title { font-size:24px !important; line-height:1.2 !important; }
      .mobile-pad { padding-left:16px !important; padding-right:16px !important; }
      .mobile-header-pad { padding:24px 16px 0 !important; }
      .mobile-footer-pad { padding:24px 16px 30px !important; }
      .info-band-pad { padding:20px 16px !important; }
      .email-logo-header { max-width:200px !important; width:200px !important; height:auto !important; }
      .email-logo-footer { max-width:168px !important; width:168px !important; height:auto !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
      .info-cell { display:block !important; width:100% !important; padding-bottom:14px !important; border-left:none !important; border-right:none !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .info-cell:first-child { border-top:none !important; }
      .feature-cell { display:block !important; width:100% !important; padding:14px 0 !important; border-top:1px solid rgba(194,153,209,0.35) !important; }
      .feature-cell:first-child { border-top:none !important; padding-top:0 !important; }
      .email-cta a { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    }`;

const LEGACY_MOBILE_MEDIA_RE =
  /@media only screen and \(max-width:600px\) \{[\s\S]*?\n    \}/g;

function patchEmailMobileStyles(html) {
  let out = String(html || '');
  if (!out.includes('@media only screen and (max-width:600px)')) return out;

  out = out.replace(LEGACY_MOBILE_MEDIA_RE, EMAIL_MOBILE_MEDIA_CSS);

  out = out.replace(
    /<td align="center" style="padding:32px 16px;">/g,
    '<td class="email-outer-pad" align="center" style="padding:32px 16px;">'
  );
  out = out.replace(
    /<td align="center" style="padding:32px 16px 56px;">/g,
    '<td class="email-outer-pad" align="center" style="padding:32px 16px 56px;">'
  );

  out = out.replace(
    /<td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;">/g,
    '<td class="mobile-header-pad" style="background:#f5f0e8;padding:32px 48px 0;text-align:center;">'
  );
  out = out.replace(
    /<td class="mobile-header-pad" style="background:#f5f0e8;padding:28px 40px 0;text-align:center;">/g,
    '<td class="mobile-header-pad" style="background:#f5f0e8;padding:28px 40px 0;text-align:center;">'
  );

  out = out.replace(
    /<td style="background:#4a4446;padding:22px 48px;">/g,
    '<td class="info-band-pad" style="background:#4a4446;padding:22px 48px;">'
  );

  out = out.replace(
    /<td style="background:#f5f0e8;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba\(194,153,209,0\.35\);">/g,
    '<td class="mobile-footer-pad" style="background:#f5f0e8;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(194,153,209,0.35);">'
  );

  out = out.replace(
    /alt="The Networker UK" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;"/g,
    'alt="The Networker UK" width="240" class="email-logo-header" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;"'
  );
  out = out.replace(
    /alt="The Networker UK" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;"/g,
    'alt="The Networker UK" width="200" class="email-logo-footer" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;"'
  );

  return out;
}

module.exports = {
  EMAIL_MOBILE_MEDIA_CSS,
  patchEmailMobileStyles,
};
