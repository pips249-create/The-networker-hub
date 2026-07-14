/**
 * Architectural line-drawing landmark marks for UK networking regions.
 * Keep in sync with api/_lib/region-landmark-icons.js
 */
(function (global) {
  function chipSvg(paths) {
    return (
      '<svg class="region-landmark-chip" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  function heroSvg(paths) {
    return (
      '<svg class="networking-region-landmark-svg" viewBox="0 0 240 90" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  var LANDMARKS = {
  "big-ben": {
    "label": "Big Ben",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><rect x=\"28\" y=\"22\" width=\"24\" height=\"50\"/><path d=\"M28 34h24M28 46h24M28 58h24\" opacity=\".35\" stroke-width=\"1\"/><rect x=\"30\" y=\"10\" width=\"20\" height=\"14\"/><circle cx=\"40\" cy=\"17\" r=\"5.5\" stroke-width=\"1.2\"/><path d=\"M40 17v-3.5M40 17l3 2\" stroke-width=\"1.1\"/><path d=\"M36 10V6h8v4\"/><path d=\"M40 3v3M37 5h6\" stroke-width=\"1.2\"/><rect x=\"33\" y=\"38\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><rect x=\"42\" y=\"38\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><rect x=\"33\" y=\"50\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><rect x=\"42\" y=\"50\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M28 72V28M52 72V28\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M48 28l4 4M48 36l4 4M48 44l4 4M48 52l4 4M48 60l4 4\" opacity=\".28\" stroke-width=\".9\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><rect x=\"96\" y=\"18\" width=\"48\" height=\"64\"/><path d=\"M96 34h48M96 50h48M96 66h48\" opacity=\".35\"/><rect x=\"102\" y=\"4\" width=\"36\" height=\"18\"/><circle cx=\"120\" cy=\"13\" r=\"8\"/><path d=\"M120 13v-5M120 13l4 3\"/><path d=\"M110 4V0h20v4\"/><path d=\"M120-2v2\"/><rect x=\"106\" y=\"42\" width=\"8\" height=\"10\" opacity=\".5\"/><rect x=\"126\" y=\"42\" width=\"8\" height=\"10\" opacity=\".5\"/><path d=\"M140 24l6 6M140 36l6 6M140 48l6 6M140 60l6 6\" opacity=\".3\"/>"
  },
  "alexandra-palace": {
    "label": "Alexandra Palace",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M6 72V48h14v24M60 72V48h14v24\"/><path d=\"M18 72V40h10v32M52 72V40h10v32\"/><path d=\"M26 72V36h28v36\"/><path d=\"M30 36c0-12 4-18 10-18s10 6 10 18\"/><ellipse cx=\"40\" cy=\"24\" rx=\"11\" ry=\"6\"/><path d=\"M40 12v6\" stroke-width=\"1.2\"/><path d=\"M10 56h6M10 62h6M64 56h6M64 62h6\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M30 48h4v8M36 48h4v8M42 48h4v8M48 48h4v8\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M26 36h28\" opacity=\".45\"/><path d=\"M50 40l4 3M50 48l4 3M50 56l4 3M50 64l4 3\" opacity=\".25\" stroke-width=\".9\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V52h36v30M180 82V52h36v30\"/><path d=\"M52 82V40h28v42M160 82V40h28v42\"/><path d=\"M72 82V32h96v50\"/><path d=\"M84 32c0-20 10-28 28-28s28 8 28 28\"/><ellipse cx=\"112\" cy=\"18\" rx=\"30\" ry=\"12\"/><path d=\"M112 2v8\"/><path d=\"M88 52h8v14M104 52h8v14M120 52h8v14M136 52h8v14\" opacity=\".5\"/>"
  },
  "o2-arena": {
    "label": "The O2 Arena",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M12 72c0-28 10-44 28-44s28 16 28 44\" stroke-width=\"1.6\"/><path d=\"M20 70c2-22 8-34 20-34M40 36c12 0 18 12 20 34M28 70c1-18 5-28 12-30M52 70c-1-18-5-28-12-30\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M40 10v14\" stroke-width=\"1.5\"/><path d=\"M18 52l-8-14M62 52l8-14M24 40l-8-10M56 40l8-10M30 28l-4-12M50 28l4-12\" stroke-width=\"1.25\"/><path d=\"M14 68h52\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M22 58h8M30 62h10M42 58h8\" opacity=\".22\" stroke-width=\".9\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M40 82c0-42 26-64 80-64s80 22 80 64\" stroke-width=\"2.2\"/><path d=\"M60 78c4-34 16-50 40-50M120 28c24 0 36 16 40 50M80 78c2-26 10-40 20-42M160 78c-2-26-10-40-20-42\" opacity=\".4\"/><path d=\"M120 8v18M52 58l-14-22M188 58l14-22M68 42l-12-16M172 42l12-16M88 26l-6-16M152 26l6-16\" stroke-width=\"1.8\"/>"
  },
  "tower-bridge": {
    "label": "Tower Bridge",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M12 72V28h14v44M54 72V28h14v44\"/><path d=\"M10 28h18v8H10zM52 28h18v8H52z\"/><path d=\"M14 28V18h4v10M22 28V18h4v10M56 28V18h4v10M64 28V18h4v10\"/><path d=\"M16 18l2-5 2 5M24 18l2-5 2 5M58 18l2-5 2 5M66 18l2-5 2 5\"/><path d=\"M26 32h28M26 36h28\" stroke-width=\"1.3\"/><path d=\"M28 32l4 4M36 32l4 4M44 32l4 4M32 36l-4-4M40 36l-4-4M48 36l-4-4\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M26 48h28\" stroke-width=\"1.5\"/><path d=\"M26 48l14-4 14 4\" opacity=\".55\" stroke-width=\"1.1\"/><rect x=\"16\" y=\"40\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><rect x=\"16\" y=\"54\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><rect x=\"59\" y=\"40\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><rect x=\"59\" y=\"54\" width=\"5\" height=\"7\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M22 40l4 3M22 50l4 3M22 60l4 3\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M36 82V28h36v54M168 82V28h36v54\"/><path d=\"M30 28h48v12H30zM162 28h48v12H162z\"/><path d=\"M42 28V12h8v16M58 28V12h8v16M174 28V12h8v16M190 28V12h8v16\"/><path d=\"M72 36h96M72 42h96\"/><path d=\"M78 36l8 6M96 36l8 6M114 36l8 6M132 36l8 6M86 42l-8-6M104 42l-8-6M122 42l-8-6M140 42l-8-6\" opacity=\".45\"/><path d=\"M72 56h96\" stroke-width=\"2\"/><rect x=\"46\" y=\"48\" width=\"10\" height=\"12\" opacity=\".5\"/><rect x=\"184\" y=\"48\" width=\"10\" height=\"12\" opacity=\".5\"/>"
  },
  "battersea": {
    "label": "Battersea Power Station",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M10 72V40h16v32M26 72V34h14v38M40 72V40h16v32M56 72V44h14v28\"/><path d=\"M14 40V18h5v22M32 34V14h5v20M46 40V18h5v22M62 44V22h5v22\"/><path d=\"M13 18h7M31 14h7M45 18h7M61 22h7\" stroke-width=\"1.3\"/><rect x=\"13\" y=\"48\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"19\" y=\"48\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"29\" y=\"44\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"35\" y=\"44\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"43\" y=\"48\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"49\" y=\"48\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"59\" y=\"52\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"65\" y=\"52\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><path d=\"M10 56h60M10 64h60\" opacity=\".3\" stroke-width=\"1\"/><path d=\"M66 48l4 3M66 56l4 3M66 64l4 3\" opacity=\".25\" stroke-width=\".9\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M32 82V40h40v42M80 82V28h40v54M128 82V40h40v42M176 82V48h32v34\"/><path d=\"M44 40V12h12v28M96 28V6h12v22M144 40V12h12v28M188 48V20h12v28\"/><path d=\"M42 12h16M94 6h16M142 12h16M186 20h16\"/><path d=\"M40 56h16v10H40zM92 48h16v10H92zM136 56h16v10h-16z\" opacity=\".5\"/>"
  },
  "manchester": {
    "label": "Beetham Tower",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M30 72V12h20v60\"/><path d=\"M30 20h20M30 28h20M30 36h20M30 44h20M30 52h20M30 60h20\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M37 12v60M43 12v60\" opacity=\".35\" stroke-width=\"1\"/><path d=\"M34 12V6h12v6\"/><path d=\"M40 3v3\" stroke-width=\"1.2\"/><path d=\"M24 72h32\" stroke-width=\"1.5\"/><path d=\"M46 16l4 4M46 28l4 4M46 40l4 4M46 52l4 4M46 64l4 4\" opacity=\".28\" stroke-width=\".9\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M100 82V10h40v72\"/><path d=\"M100 22h40M100 34h40M100 46h40M100 58h40M100 70h40\" opacity=\".4\"/><path d=\"M113 10v72M127 10v72\" opacity=\".35\"/><path d=\"M106 10V2h28v8\"/><path d=\"M90 82h60\" stroke-width=\"2\"/>"
  },
  "birmingham": {
    "label": "Birmingham Bull",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M26 30c-14-2-20-14-16-24 2 8 8 14 16 16\" stroke-width=\"1.7\"/><path d=\"M54 30c14-2 20-14 16-24-2 8-8 14-16 16\" stroke-width=\"1.7\"/><path d=\"M10 8c-1 3 1 5 3 6M70 8c1 3-1 5-3 6\" stroke-width=\"1.3\"/><path d=\"M22 34c-5 1-7 5-5 9 3-1 6-3 7-7M58 34c5 1 7 5 5 9-3-1-6-3-7-7\" stroke-width=\"1.25\"/><path d=\"M26 28c2-6 6-10 14-10s12 4 14 10\" stroke-width=\"1.5\"/><path d=\"M24 32h32\" opacity=\".45\" stroke-width=\"1.2\"/><path d=\"M24 32c-2 8-1 18 4 26h24c5-8 6-18 4-26\" stroke-width=\"1.55\"/><circle cx=\"32\" cy=\"38\" r=\"1.8\" stroke-width=\"1.15\"/><circle cx=\"48\" cy=\"38\" r=\"1.8\" stroke-width=\"1.15\"/><path d=\"M30 50h20v12H30z\" stroke-width=\"1.4\"/><ellipse cx=\"36\" cy=\"56\" rx=\"2.2\" ry=\"1.6\" stroke-width=\"1.1\"/><ellipse cx=\"44\" cy=\"56\" rx=\"2.2\" ry=\"1.6\" stroke-width=\"1.1\"/><circle cx=\"40\" cy=\"64\" r=\"4.5\" stroke-width=\"1.45\"/><path d=\"M40 59.5v-1.5\" stroke-width=\"1.2\"/><path d=\"M26 40l3 3M26 48l3 3M51 40l-3 3M51 48l-3 3\" opacity=\".28\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M78 36c-28-4-40-28-32-48 4 16 16 28 32 32M162 36c28-4 40-28 32-48-4 16-16 28-32 32\" stroke-width=\"2.2\"/><path d=\"M72 40c-10 2-14 10-10 18 6-2 12-6 14-14M168 40c10 2 14 10 10 18-6-2-12-6-14-14\"/><path d=\"M80 34c4-12 14-20 40-20s36 8 40 20\"/><path d=\"M76 40h88\"/><path d=\"M76 40c-4 14-2 32 8 46h72c10-14 12-32 8-46\"/><circle cx=\"100\" cy=\"52\" r=\"4\"/><circle cx=\"140\" cy=\"52\" r=\"4\"/><path d=\"M96 64h48v18H96z\"/><ellipse cx=\"112\" cy=\"74\" rx=\"5\" ry=\"3.5\"/><ellipse cx=\"128\" cy=\"74\" rx=\"5\" ry=\"3.5\"/><circle cx=\"120\" cy=\"88\" r=\"8\"/><path d=\"M120 80v-3\"/>"
  },
  "glasgow": {
    "label": "Finnieston Crane",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M22 72V18h6v54\" stroke-width=\"1.6\"/><path d=\"M22 28l6 6M22 40l6 6M22 52l6 6M28 28l-6 6M28 40l-6 6M28 52l-6 6\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M12 18h52v6H12z\" stroke-width=\"1.5\"/><path d=\"M16 18l8 6M28 18l8 6M40 18l8 6M52 18l6 6M20 24l-4-6M32 24l-4-6M44 24l-4-6M56 24l-4-6\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M54 24v28\" stroke-width=\"1.2\"/><path d=\"M50 52h8M52 56h4\" stroke-width=\"1.2\"/><path d=\"M12 18v10h8\" opacity=\".55\"/><path d=\"M16 72h20\" stroke-width=\"1.5\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M56 82V20h14v62\"/><path d=\"M56 34l14 10M56 50l14 10M56 66l14 10M70 34l-14 10M70 50l-14 10M70 66l-14 10\" opacity=\".45\"/><path d=\"M36 20h140v12H36z\"/><path d=\"M48 20l16 12M80 20l16 12M112 20l16 12M144 20l16 12M64 32l-16-12M96 32l-16-12M128 32l-16-12M160 32l-16-12\" opacity=\".5\"/><path d=\"M156 32v36\"/><path d=\"M148 68h16\"/>"
  },
  "edinburgh": {
    "label": "Edinburgh Castle",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72c8-22 16-32 32-32s24 10 32 32\" stroke-width=\"1.5\"/><path d=\"M16 60c4-6 8-8 12-6M40 52c6-4 12-4 16 2M52 62c3-4 6-5 10-3\" opacity=\".35\" stroke-width=\"1\"/><path d=\"M18 72V48h8v24M30 72V42h8v30M42 72V42h8v30M54 72V48h8v24\"/><path d=\"M18 48h2v-3h2v3h2v-3h2v3M30 42h2v-3h2v3h2v-3h2v3M42 42h2v-3h2v3h2v-3h2v3M54 48h2v-3h2v3h2v-3h2v3\" stroke-width=\"1.1\"/><path d=\"M36 34l4-8 4 8H36z\"/><path d=\"M40 26v-4\" stroke-width=\"1.2\"/><path d=\"M33 52h3v5M45 52h3v5\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M20 66l4 2M28 58l4 2M48 58l4 2M56 66l4 2\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82c20-36 40-48 92-48s72 12 92 48\"/><path d=\"M48 82V52h20v30M84 82V40h28v42M128 82V40h28v42M172 82V52h20v30\"/><path d=\"M112 28l8-14 8 14H112z\"/><path d=\"M92 56h8v10M140 56h8v10\" opacity=\".5\"/>"
  },
  "leeds": {
    "label": "Leeds Corn Exchange",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V44l8-18 8 18v28\"/><path d=\"M24 72V36l10-22 10 22v36\"/><path d=\"M44 72V42l8-16 8 16v30\"/><path d=\"M16 26v-4M34 14v-5M52 26v-4\" stroke-width=\"1.2\"/><path d=\"M12 52c0-4 2-6 4-6s4 2 4 6v10H12V52z\" opacity=\".55\" stroke-width=\"1\"/><path d=\"M30 46c0-5 3-8 5-8s5 3 5 8v14H30V46z\" opacity=\".55\" stroke-width=\"1\"/><path d=\"M48 50c0-4 2-6 4-6s4 2 4 6v12H48V50z\" opacity=\".55\" stroke-width=\"1\"/><path d=\"M16 52v10M35 46v14M52 50v12\" opacity=\".4\" stroke-width=\".9\"/><path d=\"M8 58h16M24 58h20M44 58h16\" opacity=\".3\" stroke-width=\"1\"/><path d=\"M38 36l4 3M38 48l4 3M38 60l4 3\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M28 82V44l20-32 20 32v38\"/><path d=\"M80 82V32l28-40 28 40v50\"/><path d=\"M148 82V48l20-28 20 28v34\"/><path d=\"M40 56c0-8 4-12 8-12s8 4 8 12v16H40V56z\" opacity=\".55\"/><path d=\"M100 44c0-10 6-16 12-16s12 6 12 16v24h-24V44z\" opacity=\".55\"/>"
  },
  "liverpool": {
    "label": "Royal Liver Building",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M14 72V32h16v40M50 72V24h16v48\"/><circle cx=\"22\" cy=\"40\" r=\"5\" stroke-width=\"1.2\"/><circle cx=\"58\" cy=\"34\" r=\"5\" stroke-width=\"1.2\"/><path d=\"M22 40v-3M58 34v-3\" stroke-width=\"1\"/><path d=\"M18 28l4-8 2 3 2-3 4 8\" stroke-width=\"1.2\"/><path d=\"M54 20l4-8 2 3 2-3 4 8\" stroke-width=\"1.2\"/><path d=\"M30 56h20v16H30z\"/><path d=\"M17 50h10M17 58h10M17 66h10M53 46h10M53 54h10M53 62h10\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M20 48v24M24 48v24M56 44v28M60 44v28\" opacity=\".3\" stroke-width=\".9\"/><path d=\"M14 32h16M50 24h16\" opacity=\".5\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M40 82V28h40v54M160 82V16h40v66\"/><circle cx=\"60\" cy=\"42\" r=\"10\"/><circle cx=\"180\" cy=\"32\" r=\"10\"/><path d=\"M52 20l8-14 4 5 4-5 8 14\"/><path d=\"M172 10l8-14 4 5 4-5 8 14\"/><path d=\"M80 62h80v20H80z\"/><path d=\"M48 56h24M48 68h24M168 48h24M168 60h24\" opacity=\".4\"/>"
  },
  "newcastle": {
    "label": "Tyne Bridge",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M10 72V40h10v32M60 72V40h10v32\"/><path d=\"M8 40c16-24 32-24 48 0 16 24 32 24 48 0\" stroke-width=\"1.8\"/><path d=\"M14 42c12-16 24-16 36 0\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M20 50h40\" stroke-width=\"1.6\"/><path d=\"M24 42v8M32 36v14M40 36v14M48 42v8\" opacity=\".55\" stroke-width=\"1\"/><path d=\"M22 50l4 4h28l4-4M26 54l4-4 4 4 4-4 4 4 4-4 4 4\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M12 52h6M12 60h6M62 52h6M62 60h6\" opacity=\".4\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82V40h32v42M180 82V40h32v42\"/><path d=\"M20 40c56-40 112-40 168 0\" stroke-width=\"2.4\"/><path d=\"M40 44c40-28 80-28 120 0\" opacity=\".45\"/><path d=\"M48 54h144\" stroke-width=\"2\"/><path d=\"M60 42v12M90 32v22M120 32v22M150 32v22M180 42v12\" opacity=\".55\"/>"
  },
  "bristol": {
    "label": "Clifton Suspension Bridge",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M12 72V34h10v38M58 72V34h10v38\"/><path d=\"M14 48h6v10H14zM60 48h6v10H60z\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M8 38c16-18 32-18 48 0s32 18 48 0\" stroke-width=\"1.6\"/><path d=\"M12 42c12-12 24-12 36 0s24 12 36 0\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M22 48h36\" stroke-width=\"1.5\"/><path d=\"M26 36v12M32 32v16M40 32v16M48 36v12\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M12 34h10M58 34h10\" stroke-width=\"1.3\"/><path d=\"M17 34v-4M63 34v-4\" stroke-width=\"1.2\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M32 82V28h28v54M180 82V28h28v54\"/><path d=\"M24 36c48-32 96-32 144 0\" stroke-width=\"2.2\"/><path d=\"M36 44c36-20 72-20 108 0\" opacity=\".45\"/><path d=\"M60 52h120\" stroke-width=\"2\"/><path d=\"M72 36v16M96 28v24M120 28v24M144 28v24M168 36v16\" opacity=\".5\"/>"
  },
  "sheffield": {
    "label": "Sheffield Steelworks",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V44h18v28M28 72V32h18v40M48 72V48h18v24\"/><path d=\"M8 44l6-8 6 8 6-8\"/><path d=\"M28 32l6-10 6 10 6-10\"/><path d=\"M48 48l5-6 5 6 5-6\"/><path d=\"M14 36V16h4v20M36 22V8h4v14M54 42V24h4v18\"/><path d=\"M16 14c2-4 0-6-1-8M38 6c2-3 1-5 0-7M56 22c2-3 0-5-1-7\" opacity=\".4\" stroke-width=\"1\"/><rect x=\"11\" y=\"52\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"17\" y=\"52\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"31\" y=\"44\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"37\" y=\"44\" width=\"4\" height=\"6\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"51\" y=\"56\" width=\"4\" height=\"5\" opacity=\".55\" stroke-width=\"1\"/><rect x=\"57\" y=\"56\" width=\"4\" height=\"5\" opacity=\".55\" stroke-width=\"1\"/><path d=\"M8 58h18M28 52h18M48 60h18\" opacity=\".3\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82V44h48v38M88 82V24h52v58M152 82V52h48v30\"/><path d=\"M28 44l12-14 12 14 12-14\"/><path d=\"M88 24l14-16 14 16 14-16\"/><path d=\"M40 30V8h8v22M108 14V0h8v14M168 40V18h8v22\"/><path d=\"M36 56h12v12H36zM100 44h12v12h-12z\" opacity=\".5\"/>"
  },
  "nottingham": {
    "label": "Nottingham Castle",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72c6-18 14-28 32-28s26 10 32 28\" stroke-width=\"1.5\"/><path d=\"M18 58c5-8 10-10 14-6M42 52c6-5 12-4 16 4\" opacity=\".35\" stroke-width=\"1\"/><path d=\"M18 72V46h10v26M32 72V40h16v32M52 72V46h10v26\"/><path d=\"M18 46h2v-3h3v3h2v-3h3v3M32 40h3v-3h3v3h4v-3h3v3M52 46h2v-3h3v3h2v-3h3v3\" stroke-width=\"1.1\"/><path d=\"M36 72v-14c0-5 2-8 4-8s4 3 4 8v14\" opacity=\".55\" stroke-width=\"1.2\"/><path d=\"M38 32l4-7 4 7H38z\"/><path d=\"M42 25v-3\" stroke-width=\"1.2\"/><path d=\"M22 54h4v5M54 54h4v5\" opacity=\".5\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82c18-32 40-42 92-42s74 10 92 42\"/><path d=\"M52 82V48h28v34M96 82V36h48v46M160 82V48h28v34\"/><path d=\"M112 24l10-14 10 14H112z\"/><path d=\"M108 82v-20c0-8 4-12 8-12s8 4 8 12v20\" opacity=\".55\"/>"
  },
  "cardiff": {
    "label": "Principality Stadium",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><ellipse cx=\"40\" cy=\"42\" rx=\"28\" ry=\"16\" stroke-width=\"1.6\"/><ellipse cx=\"40\" cy=\"42\" rx=\"18\" ry=\"9\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M12 42h56\" opacity=\".4\"/><path d=\"M16 34l8 8M64 34l-8 8M20 50l6-8M60 50l-6-8\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M18 52c6 8 14 12 22 12s16-4 22-12\" opacity=\".5\" stroke-width=\"1.2\"/><path d=\"M14 58V42M66 58V42\" stroke-width=\"1.3\"/><path d=\"M14 58h12M54 58h12\" opacity=\".45\"/><path d=\"M28 38l3 2M36 34l3 2M44 34l3 2M52 38l3 2\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><ellipse cx=\"120\" cy=\"42\" rx=\"88\" ry=\"28\"/><ellipse cx=\"120\" cy=\"42\" rx=\"52\" ry=\"14\" opacity=\".45\"/><path d=\"M40 42h160\" opacity=\".4\"/><path d=\"M48 62c18 14 44 20 72 20s54-6 72-20\" opacity=\".5\"/><path d=\"M40 62V42M200 62V42\"/>"
  },
  "brighton": {
    "label": "Royal Pavilion",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M24 72V44c4-18 10-26 16-26s12 8 16 26v28\" stroke-width=\"1.5\"/><path d=\"M32 28c0-10 3-16 8-16s8 6 8 16\" stroke-width=\"1.4\"/><path d=\"M40 8v6\" stroke-width=\"1.2\"/><path d=\"M12 72V52c2-8 5-12 8-12s6 4 8 12v20\"/><path d=\"M52 72V52c2-8 5-12 8-12s6 4 8 12v20\"/><path d=\"M16 42c0-5 2-8 4-8s4 3 4 8M56 42c0-5 2-8 4-8s4 3 4 8\"/><path d=\"M28 56c0-3 2-5 4-5s4 2 4 5v8H28V56zM40 56c0-3 2-5 4-5s4 2 4 5v8H40V56z\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M24 48h32\" opacity=\".4\"/><path d=\"M48 36l3 3M48 48l3 3M48 60l3 3\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V44c10-32 24-44 60-44s50 12 60 44v38\"/><path d=\"M100 22c0-16 8-24 20-24s20 8 20 24\"/><path d=\"M40 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M164 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M100 58c0-6 4-10 8-10s8 4 8 10v14h-16V58z\" opacity=\".5\"/>"
  },
  "cambridge": {
    "label": "King's College Chapel",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M16 72V28h48v44\"/><path d=\"M18 28V14h10v14M52 28V14h10v14\"/><path d=\"M20 14l3-6 3 6M54 14l3-6 3 6\"/><path d=\"M23 8v3M57 8v3\" stroke-width=\"1.2\"/><path d=\"M28 36c0-6 4-10 8-10s8 4 8 10v20H28V36z\" opacity=\".55\" stroke-width=\"1.2\"/><path d=\"M36 36v20M32 42h8M32 50h8\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M16 48h4M60 48h4M16 60h4M60 60h4\" opacity=\".45\"/><path d=\"M16 44h48M16 56h48\" opacity=\".28\" stroke-width=\"1\"/><path d=\"M16 28h48\" stroke-width=\"1.3\"/>",
    "hero": "<path d=\"M24 82h192\" opacity=\".35\"/><path d=\"M48 82V24h144v58\"/><path d=\"M52 24V6h28v18M160 24V6h28v18\"/><path d=\"M60 6l6-8 6 8M168 6l6-8 6 8\"/><path d=\"M96 36c0-12 8-18 16-18s16 6 16 18v28H96V36z\" opacity=\".55\"/><path d=\"M48 48h144M48 64h144\" opacity=\".3\"/>"
  },
  "oxford": {
    "label": "Radcliffe Camera",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><circle cx=\"40\" cy=\"40\" r=\"22\" stroke-width=\"1.6\"/><path d=\"M22 34c4-16 12-24 18-24s14 8 18 24\" stroke-width=\"1.4\"/><path d=\"M40 8v6\" stroke-width=\"1.2\"/><path d=\"M22 40v18M30 36v22M40 34v24M50 36v22M58 40v18\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M20 58h40v14H20z\"/><path d=\"M25 44h3v6M35 42h3v6M45 42h3v6M55 44h3v6\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M28 22c4 6 8 10 12 12M52 22c-4 6-8 10-12 12\" opacity=\".35\" stroke-width=\"1\"/><path d=\"M24 66h32M26 70h28\" opacity=\".4\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M24 82h192\" opacity=\".35\"/><circle cx=\"120\" cy=\"42\" r=\"36\"/><path d=\"M90 34c8-28 20-40 30-40s22 12 30 40\"/><path d=\"M120 2v8\"/><path d=\"M88 42v28M100 36v34M120 32v38M140 36v34M152 42v28\" opacity=\".45\"/><path d=\"M84 70h72v12H84z\"/>"
  },
  "chester": {
    "label": "Eastgate Clock",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M18 72V36h44v36\"/><path d=\"M26 72V48c0-8 4-12 14-12s14 4 14 12v24\" opacity=\".55\" stroke-width=\"1.3\"/><path d=\"M24 36h32v14H24z\"/><circle cx=\"40\" cy=\"43\" r=\"6\" stroke-width=\"1.3\"/><path d=\"M40 43v-4M40 43l3 2\" stroke-width=\"1.1\"/><path d=\"M28 36l4-8h16l4 8\"/><path d=\"M40 28v-4M36 26h8\" stroke-width=\"1.2\"/><path d=\"M30 52h4M46 52h4M32 58h3M45 58h3\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M20 44l3 3M20 54l3 3M20 64l3 3M57 44l3 3M57 54l3 3M57 64l3 3\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V32h120v50\"/><path d=\"M80 82V50c0-14 10-22 40-22s40 8 40 22v32\" opacity=\".55\"/><path d=\"M72 32h96v28H72z\"/><circle cx=\"120\" cy=\"46\" r=\"12\"/><path d=\"M120 46v-8M120 46l6 4\"/><path d=\"M84 32l10-16h52l10 16\"/>"
  }
};

  var LANDMARK_BY_REGION = {
  "central-london": "big-ben",
  "north-london": "alexandra-palace",
  "south-london": "o2-arena",
  "east-london": "tower-bridge",
  "west-london": "battersea",
  "manchester": "manchester",
  "birmingham": "birmingham",
  "glasgow": "glasgow",
  "edinburgh": "edinburgh",
  "leeds": "leeds",
  "bristol": "bristol",
  "chester": "chester",
  "liverpool": "liverpool",
  "newcastle": "newcastle",
  "sheffield": "sheffield",
  "nottingham": "nottingham",
  "cardiff": "cardiff",
  "brighton": "brighton",
  "cambridge": "cambridge",
  "oxford": "oxford"
};

  function landmarkKeyForRegion(slug) {
    return LANDMARK_BY_REGION[String(slug || '').trim().toLowerCase()] || null;
  }

  function landmarkChip(key) {
    var item = LANDMARKS[key];
    return item ? chipSvg(item.chip) : '';
  }

  function landmarkHero(key) {
    var item = LANDMARKS[key];
    return item ? heroSvg(item.hero) : '';
  }

  function landmarkForRegion(slug) {
    var key = landmarkKeyForRegion(slug);
    if (!key) return { key: null, chip: '', hero: '', label: '' };
    var item = LANDMARKS[key];
    return {
      key: key,
      chip: landmarkChip(key),
      hero: landmarkHero(key),
      label: item ? item.label : '',
    };
  }

  global.HUB_REGION_LANDMARKS = {
    LANDMARKS: LANDMARKS,
    LANDMARK_BY_REGION: LANDMARK_BY_REGION,
    landmarkKeyForRegion: landmarkKeyForRegion,
    landmarkChip: landmarkChip,
    landmarkHero: landmarkHero,
    landmarkForRegion: landmarkForRegion,
  };
})(typeof window !== 'undefined' ? window : globalThis);
