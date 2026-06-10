/** Recommended minimum logo dimensions for sharp display on profile and browse cards. */
const MIN_LONG_EDGE = 800;
const MIN_SHORT_EDGE = 400;

function logoResolutionWarning(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return null;
  const longEdge = Math.max(w, h);
  const shortEdge = Math.min(w, h);
  if (longEdge >= MIN_LONG_EDGE && shortEdge >= MIN_SHORT_EDGE) return null;
  return (
    `This logo is ${w}×${h}px and may look blurry on your profile. ` +
    `Please use a higher-resolution image — at least ${MIN_LONG_EDGE}px on the longest side ` +
    `and ${MIN_SHORT_EDGE}px on the shortest.`
  );
}

module.exports = {
  MIN_LONG_EDGE,
  MIN_SHORT_EDGE,
  logoResolutionWarning,
};
