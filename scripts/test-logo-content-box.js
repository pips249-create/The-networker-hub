/**
 * Unit checks for County/City Sponsor logo padding trim math.
 * Mirrors js/cms-sponsor-fields.js logoContentBox colour-diff + pad rules.
 */
'use strict';

function contentBoxFromRgba(data, w, h, opts) {
  opts = opts || {};
  var colorThreshold = opts.colorThreshold || 36;
  var padRatio = opts.padRatio || 0.22;

  function sample(x, y) {
    var i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  var corners = [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)];
  var opaqueCorners = 0;
  var bgR = 0;
  var bgG = 0;
  var bgB = 0;
  var transparentEdges = 0;
  for (var c = 0; c < corners.length; c++) {
    if (corners[c][3] < 40) {
      transparentEdges++;
      continue;
    }
    opaqueCorners++;
    bgR += corners[c][0];
    bgG += corners[c][1];
    bgB += corners[c][2];
  }
  var alphaTrimOnly = transparentEdges >= 3 || opaqueCorners === 0;
  if (opaqueCorners) {
    bgR /= opaqueCorners;
    bgG /= opaqueCorners;
    bgB /= opaqueCorners;
  }
  if (!alphaTrimOnly && opaqueCorners >= 2) {
    var cornerSpread = 0;
    for (var s = 0; s < corners.length; s++) {
      if (corners[s][3] < 40) continue;
      cornerSpread = Math.max(
        cornerSpread,
        Math.abs(corners[s][0] - bgR) +
          Math.abs(corners[s][1] - bgG) +
          Math.abs(corners[s][2] - bgB)
      );
    }
    if (cornerSpread > 48) return null;
  }

  var minX = w;
  var minY = h;
  var maxX = -1;
  var maxY = -1;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var a = data[i + 3];
      if (a < 40) continue;
      if (!alphaTrimOnly) {
        var diff =
          Math.abs(data[i] - bgR) +
          Math.abs(data[i + 1] - bgG) +
          Math.abs(data[i + 2] - bgB);
        if (diff < colorThreshold) continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;

  var contentW = maxX - minX + 1;
  var contentH = maxY - minY + 1;
  var areaRatio = (contentW * contentH) / (w * h);
  if (areaRatio > 0.82 || areaRatio < 0.004) return null;

  var padX = Math.max(2, Math.round(contentW * padRatio));
  var padY = Math.max(2, Math.round(contentH * padRatio));
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w - 1, maxX + padX);
  maxY = Math.min(h - 1, maxY + padY);

  var sw = maxX - minX + 1;
  var sh = maxY - minY + 1;
  if (sw < 8 || sh < 8) return null;
  if (sw * sh > w * h * 0.92) return null;
  return { sx: minX, sy: minY, sw: sw, sh: sh, areaRatio: areaRatio };
}

function fillRect(data, w, x0, y0, x1, y1, rgba) {
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      var i = (y * w + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Locora-like solid green plate with a small cream wordmark in the centre.
var W = 200;
var H = 140;
var buf = new Uint8ClampedArray(W * H * 4);
fillRect(buf, W, 0, 0, W - 1, H - 1, [51, 106, 63, 255]);
fillRect(buf, W, 70, 60, 130, 78, [244, 238, 234, 255]);
var box = contentBoxFromRgba(buf, W, H);
assert(box, 'expected trim on padded brand plate');
assert(box.sw < W * 0.7, 'trimmed width should be much smaller than frame');
assert(box.sh < H * 0.55, 'trimmed height should be much smaller than frame');
assert(box.sx > 20 && box.sy > 20, 'trim should cut into the padding');

// Already-tight logo should be left alone.
var tight = new Uint8ClampedArray(80 * 40 * 4);
fillRect(tight, 80, 0, 0, 79, 39, [20, 20, 20, 255]);
fillRect(tight, 80, 4, 4, 75, 35, [240, 240, 240, 255]);
assert(contentBoxFromRgba(tight, 80, 40) === null, 'tight logos must not trim');

// Transparent PNG with edge margins should trim via alpha.
var png = new Uint8ClampedArray(100 * 60 * 4);
fillRect(png, 100, 30, 20, 70, 40, [30, 30, 200, 255]);
var alphaBox = contentBoxFromRgba(png, 100, 60);
assert(alphaBox, 'expected alpha trim');
assert(alphaBox.sw < 90 && alphaBox.sh < 50, 'alpha trim should crop margins');

console.log('test-logo-content-box: ok');
