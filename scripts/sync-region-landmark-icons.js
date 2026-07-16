#!/usr/bin/env node
/**
 * Regenerates js/region-landmark-icons.js from api/_lib/region-landmark-icons.js.
 * Run after editing landmark SVG paths or LANDMARK_BY_REGION mappings.
 */
const fs = require('fs');
const path = require('path');
const { LANDMARKS, LANDMARK_BY_REGION } = require('../api/_lib/region-landmark-icons');

const outPath = path.join(__dirname, '../js/region-landmark-icons.js');

const body =
  '/**\n' +
  ' * Architectural line-drawing landmark marks for UK networking regions.\n' +
  ' * Keep in sync with api/_lib/region-landmark-icons.js\n' +
  ' */\n' +
  '(function (global) {\n' +
  '  function chipSvg(paths) {\n' +
  "    return (\n" +
  "      '<svg class=\"region-landmark-chip\" viewBox=\"0 0 80 80\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.35\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">' +\n" +
  '      paths +\n' +
  "      '</svg>'\n" +
  '    );\n' +
  '  }\n\n' +
  '  function heroSvg(paths) {\n' +
  "    return (\n" +
  "      '<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">' +\n" +
  '      paths +\n' +
  "      '</svg>'\n" +
  '    );\n' +
  '  }\n\n' +
  '  var LANDMARKS = ' +
  JSON.stringify(LANDMARKS, null, 2) +
  ';\n\n' +
  '  var LANDMARK_BY_REGION = ' +
  JSON.stringify(LANDMARK_BY_REGION, null, 2) +
  ';\n\n' +
  '  function landmarkKeyForRegion(slug) {\n' +
  "    return LANDMARK_BY_REGION[String(slug || '').trim().toLowerCase()] || null;\n" +
  '  }\n\n' +
  '  function landmarkChip(key) {\n' +
  '    var item = LANDMARKS[key];\n' +
  "    return item ? chipSvg(item.chip) : '';\n" +
  '  }\n\n' +
  '  function landmarkHero(key) {\n' +
  '    var item = LANDMARKS[key];\n' +
  "    return item ? heroSvg(item.hero) : '';\n" +
  '  }\n\n' +
  '  function landmarkForRegion(slug) {\n' +
  '    var key = landmarkKeyForRegion(slug);\n' +
  "    if (!key) return { key: null, chip: '', hero: '', label: '' };\n" +
  '    var item = LANDMARKS[key];\n' +
  '    return {\n' +
  '      key: key,\n' +
  '      chip: landmarkChip(key),\n' +
  '      hero: landmarkHero(key),\n' +
  "      label: item ? item.label : '',\n" +
  '    };\n' +
  '  }\n\n' +
  '  global.HUB_REGION_LANDMARKS = {\n' +
  '    LANDMARKS: LANDMARKS,\n' +
  '    LANDMARK_BY_REGION: LANDMARK_BY_REGION,\n' +
  '    landmarkKeyForRegion: landmarkKeyForRegion,\n' +
  '    landmarkChip: landmarkChip,\n' +
  '    landmarkHero: landmarkHero,\n' +
  '    landmarkForRegion: landmarkForRegion,\n' +
  '  };\n' +
  "})(typeof window !== 'undefined' ? window : globalThis);\n";

fs.writeFileSync(outPath, body);
console.log('Updated js/region-landmark-icons.js');
