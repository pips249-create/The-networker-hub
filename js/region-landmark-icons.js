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
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M32 72V22h16v50\" stroke-width=\"1.6\"/><path d=\"M34 22V6h12v16\" stroke-width=\"1.5\"/><path d=\"M30 22h20\" stroke-width=\"1.6\"/><path d=\"M40 3v3\" stroke-width=\"1.3\"/><path d=\"M32 30h16M32 38h16M32 46h16M32 54h16M32 62h16\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M37 22v50M43 22v50\" opacity=\".32\" stroke-width=\"1\"/><path d=\"M26 72h28\" stroke-width=\"1.6\"/><path d=\"M46 26l4 3M46 42l4 3M46 58l4 3\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V24h32v58\"/><path d=\"M108 24V4h24v20\"/><path d=\"M98 24h44\" stroke-width=\"2\"/><path d=\"M104 36h32M104 48h32M104 60h32M104 72h32\" opacity=\".4\"/><path d=\"M114 24v58M126 24v58\" opacity=\".35\"/><path d=\"M90 82h60\" stroke-width=\"2\"/>"
  },
  "birmingham": {
    "label": "Birmingham Bull",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M30 32C12 30 6 16 14 4c0 10 6 18 16 24\" fill=\"none\" stroke-width=\"2.3\"/><path d=\"M50 32C68 30 74 16 66 4c0 10-6 18-16 24\" fill=\"none\" stroke-width=\"2.3\"/><path d=\"M26 36l-8 2 2 8 8-4M54 36l8 2-2 8-8-4\" stroke-width=\"1.35\"/><path d=\"M28 30h24l2 8H26z\" stroke-width=\"1.45\"/><path d=\"M26 38c-1 10 2 20 8 26h12c6-6 9-16 8-26\" stroke-width=\"1.55\"/><path d=\"M28 40h24\" opacity=\".5\"/><circle cx=\"34\" cy=\"44\" r=\"1.7\" stroke-width=\"1.2\"/><circle cx=\"46\" cy=\"44\" r=\"1.7\" stroke-width=\"1.2\"/><path d=\"M32 54h16v10H32z\" stroke-width=\"1.4\"/><path d=\"M36 58v3M44 58v3\" stroke-width=\"1.35\"/><circle cx=\"40\" cy=\"66\" r=\"4.2\" stroke-width=\"1.5\"/><path d=\"M40 61.8v-1.3\" stroke-width=\"1.2\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M90 38C54 34 42 10 56-4c0 20 14 36 34 46M150 38c36-4 48-28 34-42 0 20-14 36-34 46\" stroke-width=\"3\"/><path d=\"M84 44l-14 4 4 14 14-8M156 44l14 4-4 14-14-8\"/><path d=\"M88 36h64l4 14H84z\"/><path d=\"M84 50c-2 18 4 34 16 44h40c12-10 18-26 16-44\"/><circle cx=\"104\" cy=\"58\" r=\"4\"/><circle cx=\"136\" cy=\"58\" r=\"4\"/><path d=\"M100 70h40v16H100z\"/><path d=\"M110 76v5M130 76v5\" stroke-width=\"2\"/><circle cx=\"120\" cy=\"92\" r=\"9\"/><path d=\"M120 83v-4\"/>"
  },
  "glasgow": {
    "label": "Finnieston Crane",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M22 72V18h6v54\" stroke-width=\"1.6\"/><path d=\"M22 28l6 6M22 40l6 6M22 52l6 6M28 28l-6 6M28 40l-6 6M28 52l-6 6\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M12 18h52v6H12z\" stroke-width=\"1.5\"/><path d=\"M16 18l8 6M28 18l8 6M40 18l8 6M52 18l6 6M20 24l-4-6M32 24l-4-6M44 24l-4-6M56 24l-4-6\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M54 24v28\" stroke-width=\"1.2\"/><path d=\"M50 52h8M52 56h4\" stroke-width=\"1.2\"/><path d=\"M12 18v10h8\" opacity=\".55\"/><path d=\"M16 72h20\" stroke-width=\"1.5\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M56 82V20h14v62\"/><path d=\"M56 34l14 10M56 50l14 10M56 66l14 10M70 34l-14 10M70 50l-14 10M70 66l-14 10\" opacity=\".45\"/><path d=\"M36 20h140v12H36z\"/><path d=\"M48 20l16 12M80 20l16 12M112 20l16 12M144 20l16 12M64 32l-16-12M96 32l-16-12M128 32l-16-12M160 32l-16-12\" opacity=\".5\"/><path d=\"M156 32v36\"/><path d=\"M148 68h16\"/>"
  },
  "edinburgh": {
    "label": "Edinburgh Castle",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M6 72L14 54l8 6 10-22 8 4 10-18 8 8 10-10 8 12 8 20v18H6z\" stroke-width=\"1.55\"/><path d=\"M16 62l6-4 8 2M34 50l8-3 10 2M50 44l6-2\" opacity=\".35\" stroke-width=\"1\"/><path d=\"M24 40h34\" stroke-width=\"1.6\"/><path d=\"M24 40V26h10v14\" stroke-width=\"1.45\"/><path d=\"M24 26h2v-3h2v3h2v-3h2v3h2\" stroke-width=\"1.2\"/><path d=\"M34 40V18h14v22\" stroke-width=\"1.5\"/><path d=\"M34 18h2v-3h2v3h2v-3h2v3h2v-3h2v3h2\" stroke-width=\"1.2\"/><path d=\"M48 40V28h10v12\" stroke-width=\"1.45\"/><path d=\"M48 28h2v-3h2v3h2v-3h2v3h2\" stroke-width=\"1.2\"/><path d=\"M41 15V6\" stroke-width=\"1.3\"/><path d=\"M41 6h8l-2.5 2.5L49 11H41z\" stroke-width=\"1.15\"/><path d=\"M28 32h3v4M40 26h4v5M52 33h3v4\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M20 58l3 4M36 48l3 4M54 52l3 4\" opacity=\".28\" stroke-width=\".9\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82L40 56l16 10 20-36 16 8 24-32 16 14 20-18 16 20 20 40v20H24z\" stroke-width=\"2\"/><path d=\"M72 48h96\" stroke-width=\"2.2\"/><path d=\"M72 48V28h24v20M96 48V16h40v32M136 48V30h28v18\"/><path d=\"M72 28h3v-5h4v5h4v-5h4v5h5\"/><path d=\"M96 16h4v-5h5v5h5v-5h5v5h5v-5h5v5h6\"/><path d=\"M136 30h3v-5h4v5h4v-5h4v5h5\"/><path d=\"M116 16V2M116 2h14l-4 4 4 4h-14\"/><path d=\"M84 36h6v8M112 28h8v10M148 36h6v8\" opacity=\".5\"/>"
  },
  "leeds": {
    "label": "Leeds Town Hall",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M10 72V48h60v24\" stroke-width=\"1.45\"/><path d=\"M14 48v16M22 48v16M30 48v16M50 48v16M58 48v16M66 48v16\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M10 48l30-10 30 10\" stroke-width=\"1.45\"/><path d=\"M30 38V12h20v26\" stroke-width=\"1.55\"/><circle cx=\"40\" cy=\"22\" r=\"6\" stroke-width=\"1.3\"/><path d=\"M40 22v-4M40 22l3 2\" stroke-width=\"1.1\"/><path d=\"M32 12h16l-2-5H34z\" stroke-width=\"1.3\"/><path d=\"M40 7V3\" stroke-width=\"1.25\"/><path d=\"M8 72h64M12 68h56\" opacity=\".4\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M36 82V52h168v30\"/><path d=\"M48 52v28M72 52v28M96 52v28M144 52v28M168 52v28M192 52v28\" opacity=\".45\"/><path d=\"M36 52l84-22 84 22\"/><path d=\"M100 40V10h40v30\"/><circle cx=\"120\" cy=\"24\" r=\"10\"/><path d=\"M120 24v-6M120 24l5 3\"/><path d=\"M104 10h32l-4-8h-24z\"/><path d=\"M120 2v-4\"/>"
  },
  "liverpool": {
    "label": "Royal Liver Building",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M12 72V34h18v38M50 72V26h18v46\" stroke-width=\"1.5\"/><circle cx=\"21\" cy=\"44\" r=\"5.5\" stroke-width=\"1.25\"/><circle cx=\"59\" cy=\"38\" r=\"5.5\" stroke-width=\"1.25\"/><path d=\"M21 44v-3.5M59 38v-3.5\" stroke-width=\"1.1\"/><path d=\"M16 30c0-6 3-10 5-10 1 0 2 2 3 4l2-6c2 4 3 8 2 12\" stroke-width=\"1.3\"/><path d=\"M18 24l4 2M22 20l3-2\" stroke-width=\"1.1\"/><path d=\"M54 22c0-6 3-10 5-10 1 0 2 2 3 4l2-6c2 4 3 8 2 12\" stroke-width=\"1.3\"/><path d=\"M56 16l4 2M60 12l3-2\" stroke-width=\"1.1\"/><path d=\"M30 58h20v14H30z\" stroke-width=\"1.35\"/><path d=\"M16 54h10M16 62h10M54 48h10M54 56h10M54 64h10\" opacity=\".4\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M40 82V28h40v54M160 82V16h40v66\"/><circle cx=\"60\" cy=\"42\" r=\"10\"/><circle cx=\"180\" cy=\"32\" r=\"10\"/><path d=\"M48 20c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22\"/><path d=\"M168 8c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22\"/><path d=\"M80 62h80v20H80z\"/><path d=\"M48 56h24M48 68h24M168 48h24M168 60h24\" opacity=\".4\"/>"
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
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72c4-10 12-16 32-16s28 6 32 16\" stroke-width=\"1.5\"/><path d=\"M16 56V34h48v22\" stroke-width=\"1.5\"/><path d=\"M28 34l12-10 12 10\" stroke-width=\"1.4\"/><path d=\"M34 56v-14c0-4 2-6 6-6s6 2 6 6v14\" opacity=\".55\" stroke-width=\"1.25\"/><path d=\"M16 34V26h8v8M56 34V26h8v8\" stroke-width=\"1.35\"/><path d=\"M16 26h2v-3h2v3h2v-3h2v3M56 26h2v-3h2v3h2v-3h2v3\" stroke-width=\"1.1\"/><path d=\"M40 24V14M40 14h7l-2 2 2 2H40\" stroke-width=\"1.2\"/><path d=\"M20 42h5v6M55 42h5v6\" opacity=\".5\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82c14-18 36-26 92-26s78 8 92 26\"/><path d=\"M48 62V34h144v28\"/><path d=\"M88 34l32-22 32 22\"/><path d=\"M108 62v-20c0-8 5-12 12-12s12 4 12 12v20\" opacity=\".55\"/><path d=\"M48 34V20h22v14M170 34V20h22v14\"/><path d=\"M120 12V0M120 0h16l-4 4 4 4h-16\"/>"
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
  },
  "belfast-city-hall": {
    "label": "Belfast City Hall",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M14 72V42h52v30\" stroke-width=\"1.45\"/><path d=\"M14 42l26-12 26 12\" stroke-width=\"1.4\"/><path d=\"M30 42V28h20v14\" stroke-width=\"1.45\"/><circle cx=\"40\" cy=\"34\" r=\"5\" stroke-width=\"1.2\"/><path d=\"M36 28h8l-2-6h-4z\" stroke-width=\"1.2\"/><path d=\"M40 22v3\" stroke-width=\"1.2\"/><path d=\"M20 52h8M52 52h8M20 62h8M52 62h8\" opacity=\".45\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M48 82V44h144v38\"/><path d=\"M48 44l72-18 72 18\"/><path d=\"M96 44V24h48v20\"/><circle cx=\"120\" cy=\"34\" r=\"10\"/><path d=\"M108 24h24l-4-10h-16z\"/><path d=\"M120 14v4\"/><path d=\"M64 56h16M160 56h16\" opacity=\".45\"/>"
  },
  "reading-blade": {
    "label": "The Blade",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M34 72V14h12v58\" stroke-width=\"1.55\"/><path d=\"M30 72h20\" stroke-width=\"1.5\"/><path d=\"M34 24h12M34 36h12M34 48h12M34 60h12\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M38 14V6h4v8\" stroke-width=\"1.3\"/><path d=\"M46 20l4 3M46 36l4 3M46 52l4 3\" opacity=\".25\" stroke-width=\".85\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V12h32v70\"/><path d=\"M90 82h60\" stroke-width=\"2\"/><path d=\"M104 28h32M104 44h32M104 60h32\" opacity=\".4\"/><path d=\"M112 12V0h16v12\"/><path d=\"M140 24l8 6M140 44l8 6M140 64l8 6\" opacity=\".3\"/>"
  },
  "leicester-clock-tower": {
    "label": "Leicester Clock Tower",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M28 72V38h24v34\" stroke-width=\"1.5\"/><path d=\"M26 38h28\" stroke-width=\"1.4\"/><path d=\"M32 38V24h16v14\" stroke-width=\"1.4\"/><circle cx=\"40\" cy=\"30\" r=\"5.5\" stroke-width=\"1.2\"/><path d=\"M40 30v-3.5M40 30l2.5 2\" stroke-width=\"1.1\"/><path d=\"M34 18h12l-2-6h-8z\" stroke-width=\"1.2\"/><path d=\"M40 12v3\" stroke-width=\"1.2\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M96 82V34h48v48\"/><path d=\"M92 34h56\"/><path d=\"M104 34V16h32v18\"/><circle cx=\"120\" cy=\"26\" r=\"9\"/><path d=\"M120 26v-5M120 26l4 3\"/><path d=\"M108 16h24l-3-8h-18z\"/><path d=\"M120 8v4\"/>"
  },
  "bournemouth-pier": {
    "label": "Bournemouth Pier",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M10 72V58h12v14M58 72V58h12v14\" stroke-width=\"1.4\"/><path d=\"M22 58h36\" stroke-width=\"1.5\"/><path d=\"M26 58V48h28v10\" stroke-width=\"1.35\"/><path d=\"M24 48l16-8 16 8\" stroke-width=\"1.3\"/><path d=\"M36 40v8M44 40v8\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M14 62h4M62 62h4\" opacity=\".4\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M40 82h160\" opacity=\".35\"/><path d=\"M48 82V56h24v26M168 82V56h24v26\"/><path d=\"M72 56h96\" stroke-width=\"2\"/><path d=\"M80 56V42h80v14\"/><path d=\"M72 42l48-16 48 16\"/><path d=\"M104 30v12M128 30v12\" opacity=\".45\"/>"
  },
  "blackpool-tower": {
    "label": "Blackpool Tower",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M22 72L32 26h16L58 72\" stroke-width=\"1.35\"/><path d=\"M28 72L36 34h8L52 72\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M26 56l10-8 10 8M30 44l8-6 8 6\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M30 26h20\" stroke-width=\"1.4\"/><ellipse cx=\"40\" cy=\"24\" rx=\"12\" ry=\"3.5\"/><path d=\"M40 20V6\" stroke-width=\"1.3\"/><path d=\"M36 12h8\" stroke-width=\"1.15\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M78 82L100 18h40L162 82\"/><path d=\"M90 82L108 30h24L150 82\" opacity=\".45\"/><path d=\"M88 58l16-12 16 12M96 40l12-8 12 8\" opacity=\".5\"/><path d=\"M96 18h48\"/><ellipse cx=\"120\" cy=\"16\" rx=\"22\" ry=\"6\"/><path d=\"M120 10V0\"/><path d=\"M112 4h16\"/>"
  },
  "canterbury-cathedral": {
    "label": "Canterbury Cathedral",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V46h64v26\"/><path d=\"M8 46V30h12v16M60 46V30h12v16\"/><path d=\"M8 30l6-8 6 8M60 30l6-8 6 8\"/><path d=\"M28 46V14h24v32\" stroke-width=\"1.4\"/><path d=\"M26 14h28\" stroke-width=\"1.3\"/><path d=\"M34 14V6h12v8\"/><path d=\"M40 6V2\" stroke-width=\"1.2\"/><path d=\"M30 14l-3-5M50 14l3-5\" opacity=\".6\" stroke-width=\"1\"/><path d=\"M14 56h6M34 56h4M42 56h4M58 56h6\" opacity=\".45\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V48h192v34\"/><path d=\"M24 48V28h28v20M188 48V28h28v20\"/><path d=\"M24 28l14-12 14 12M188 28l14-12 14 12\"/><path d=\"M88 48V12h64v36\" stroke-width=\"2\"/><path d=\"M84 12h72\"/><path d=\"M104 12V2h32v10\"/><path d=\"M120 2V-4\"/><path d=\"M92 12l-6-8M148 12l6-8\" opacity=\".6\"/><path d=\"M40 62h14M96 62h12M132 62h12M186 62h14\" opacity=\".45\"/>"
  },
  "spinnaker-tower": {
    "label": "Spinnaker Tower",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M36 72V8\" stroke-width=\"1.45\"/><path d=\"M36 16c18 8 24 24 18 46\" stroke-width=\"1.4\"/><path d=\"M36 20c12 6 16 16 12 30\" opacity=\".45\" stroke-width=\"1.1\"/><ellipse cx=\"36\" cy=\"34\" rx=\"9\" ry=\"3.2\"/><path d=\"M28 72h20\" stroke-width=\"1.3\"/><path d=\"M32 64h10\" opacity=\".5\" stroke-width=\"1.1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M108 82V6\" stroke-width=\"2.2\"/><path d=\"M108 14c48 16 62 40 46 64\" stroke-width=\"2\"/><path d=\"M108 20c28 10 38 26 28 46\" opacity=\".45\"/><ellipse cx=\"108\" cy=\"36\" rx=\"18\" ry=\"6\"/><path d=\"M88 82h48\" stroke-width=\"2\"/><path d=\"M96 70h24\" opacity=\".5\"/>"
  },
  "southend-pier": {
    "label": "Southend Pier",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M6 56h68\" stroke-width=\"1.55\"/><path d=\"M12 56v14M24 56v14M36 56v14M48 56v14M60 56v14M70 56v14\" opacity=\".5\" stroke-width=\"1\"/><path d=\"M6 56V42h16v14\"/><path d=\"M8 42l6-7 6 7\"/><path d=\"M56 56V44h16v12\"/><circle cx=\"64\" cy=\"50\" r=\"3.2\" opacity=\".65\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M20 58h200\" stroke-width=\"2\"/><path d=\"M36 58v20M68 58v20M100 58v20M132 58v20M164 58v20M196 58v20\" opacity=\".5\"/><path d=\"M20 58V36h36v22\"/><path d=\"M24 36l14-14 14 14\"/><path d=\"M168 58V40h40v18\"/><circle cx=\"188\" cy=\"48\" r=\"6\" opacity=\".65\"/>"
  },
  "st-albans-abbey": {
    "label": "St Albans Cathedral",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M6 72V48h68v24\"/><path d=\"M26 48V16h28v32\" stroke-width=\"1.45\"/><path d=\"M24 16h32\" stroke-width=\"1.3\"/><path d=\"M28 16v-5h5v5M37 16v-5h6v5M47 16v-5h5v5\" stroke-width=\"1.1\"/><path d=\"M26 28h28M26 38h28\" opacity=\".35\" stroke-width=\"1\"/><path d=\"M6 48l10-8h8M64 48l-10-8h-8\" opacity=\".7\" stroke-width=\"1.15\"/><path d=\"M12 58h8v8M60 58h8v8M36 26h8v12\" opacity=\".5\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M20 82V50h200v32\"/><path d=\"M84 50V14h72v36\" stroke-width=\"2\"/><path d=\"M80 14h80\"/><path d=\"M90 14v-8h12v8M114 14v-8h12v8M138 14v-8h12v8\"/><path d=\"M84 30h72M84 42h72\" opacity=\".35\"/><path d=\"M20 50l24-14h16M196 50l-24-14h-16\" opacity=\".7\"/><path d=\"M36 62h16v12M188 62h16v12M112 28h16v16\" opacity=\".5\"/>"
  },
  "hampton-court": {
    "label": "Hampton Court Palace",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M6 72V42h16v30M58 72V42h16v30\"/><path d=\"M22 72V34h36v38\" stroke-width=\"1.35\"/><path d=\"M22 34V22h8v12M50 34V22h8v12\"/><path d=\"M22 22h8l-1-5h-6zM50 22h8l-1-5h-6z\"/><circle cx=\"40\" cy=\"30\" r=\"4\" stroke-width=\"1.15\"/><path d=\"M32 72V56c0-5 3-8 8-8s8 3 8 8v16\" opacity=\".55\" stroke-width=\"1.15\"/><path d=\"M10 42V32h3v10M15 42V30h3v12M62 42V32h3v10M67 42V30h3v12\" stroke-width=\"1.05\"/><path d=\"M26 46l4 4M36 46l4 4M46 46l4 4\" opacity=\".3\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M20 82V44h40v38M180 82V44h40v38\"/><path d=\"M60 82V32h120v50\" stroke-width=\"2\"/><path d=\"M60 32V16h20v16M160 32V16h20v16\"/><path d=\"M60 16h20l-3-8h-14zM160 16h20l-3-8h-14z\"/><circle cx=\"120\" cy=\"28\" r=\"8\"/><path d=\"M100 82V58c0-10 6-16 20-16s20 6 20 16v24\" opacity=\".55\"/><path d=\"M28 44V30h6v14M40 44V26h6v18M188 44V30h6v14M200 44V26h6v18\"/>"
  },
  "stowe-arch": {
    "label": "Stowe Corinthian Arch",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M10 72V56h60v16\"/><path d=\"M14 56V34M24 56V34M34 56V30M46 56V30M56 56V34M66 56V34\" stroke-width=\"1.2\"/><path d=\"M10 34h60\" stroke-width=\"1.4\"/><path d=\"M12 30h56\" stroke-width=\"1.2\"/><path d=\"M18 30l22-16 22 16\"/><path d=\"M36 56V38h8v18\" opacity=\".45\" stroke-width=\"1.1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82V58h184v24\"/><path d=\"M40 58V32M64 58V32M96 58V24M144 58V24M176 58V32M200 58V32\"/><path d=\"M28 32h184\" stroke-width=\"2\"/><path d=\"M36 26h168\"/><path d=\"M56 26l64-22 64 22\"/><path d=\"M104 58V36h32v22\" opacity=\".45\"/>"
  },
  "york-minster": {
    "label": "York Minster",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M10 72V40h60v32\"/><path d=\"M10 40V24h14v16M56 40V24h14v16\"/><path d=\"M10 24l7-10 7 10M56 24l7-10 7 10\"/><path d=\"M30 40V14h20v26\" stroke-width=\"1.4\"/><path d=\"M28 14h24\" stroke-width=\"1.3\"/><path d=\"M34 14V8h12v6\"/><path d=\"M16 54h6M58 54h6M36 22h8v10\" opacity=\".5\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V40h192v42\"/><path d=\"M24 40V22h32v18M184 40V22h32v18\"/><path d=\"M24 22l16-16 16 16M184 22l16-16 16 16\"/><path d=\"M88 40V12h64v28\" stroke-width=\"2\"/><path d=\"M84 12h72\"/><path d=\"M104 12V4h32v8\"/><path d=\"M40 56h16M184 56h16M108 24h24v16\" opacity=\".5\"/>"
  },
  "corfe-castle": {
    "label": "Corfe Castle",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72c10-12 18-16 32-16s22 4 32 16\"/><path d=\"M30 56V26h20v30\" stroke-width=\"1.4\"/><path d=\"M28 26h24\"/><path d=\"M32 26v-6h4v6M44 26v-6h4v6\"/><path d=\"M16 56V38h10v18M54 56V42h10v14\"/><path d=\"M16 38l5-7M26 38l-3-5M54 42l4-6\" opacity=\".7\" stroke-width=\"1.1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M24 82c28-22 48-28 96-28s68 6 96 28\"/><path d=\"M96 62V22h48v40\" stroke-width=\"2\"/><path d=\"M92 22h56\"/><path d=\"M100 22v-10h8v10M132 22v-10h8v10\"/><path d=\"M48 62V40h24v22M168 62V46h24v16\"/><path d=\"M48 40l10-12M72 40l-6-8M168 46l8-10\" opacity=\".7\"/>"
  },
  "smeaton-tower": {
    "label": "Smeaton's Tower",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M32 72V28h16v44\" stroke-width=\"1.4\"/><path d=\"M30 28h20l-4-8h-12z\"/><path d=\"M36 20h8v-6h-8z\"/><path d=\"M40 14V8\" stroke-width=\"1.2\"/><circle cx=\"40\" cy=\"17\" r=\"2.6\" stroke-width=\"1.1\"/><path d=\"M32 40h16M32 52h16M32 64h16\" opacity=\".4\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V24h32v58\" stroke-width=\"2\"/><path d=\"M100 24h40l-8-14h-24z\"/><path d=\"M112 10h16V2h-16z\"/><path d=\"M120 2V-4\"/><circle cx=\"120\" cy=\"8\" r=\"4\"/><path d=\"M104 40h32M104 56h32M104 70h32\" opacity=\".4\"/>"
  },
  "lichfield-cathedral": {
    "label": "Lichfield Cathedral",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V48h64v24\"/><path d=\"M12 48L20 16l8 32\" stroke-width=\"1.25\"/><path d=\"M28 48L40 4l12 44\" stroke-width=\"1.35\"/><path d=\"M52 48l8-32 8 32\" stroke-width=\"1.25\"/><path d=\"M20 16V10M40 4V0M60 16V10\" stroke-width=\"1.15\"/><path d=\"M24 58h6M38 58h6M52 58h6\" opacity=\".45\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V48h192v34\"/><path d=\"M40 48L64 8l24 40\"/><path d=\"M88 48L120 0l32 48\" stroke-width=\"2\"/><path d=\"M152 48l24-40 24 40\"/><path d=\"M64 8V0M120 0v-6M176 8V0\"/><path d=\"M56 62h16M112 62h16M168 62h16\" opacity=\".45\"/>"
  },
  "norwich-cathedral": {
    "label": "Norwich Cathedral",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V46h64v26\"/><path d=\"M28 46V30h24v16\" stroke-width=\"1.35\"/><path d=\"M28 30L40 4l12 26\" stroke-width=\"1.35\"/><path d=\"M40 4V0\" stroke-width=\"1.2\"/><path d=\"M8 46l12-8M72 46l-12-8\" opacity=\".55\" stroke-width=\"1.1\"/><path d=\"M14 58h8M36 34h8v8M58 58h8\" opacity=\".45\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V48h192v34\"/><path d=\"M88 48V28h64v20\" stroke-width=\"2\"/><path d=\"M88 28L120 0l32 28\" stroke-width=\"2\"/><path d=\"M120 0V-6\"/><path d=\"M24 48l28-14M216 48l-28-14\" opacity=\".55\"/><path d=\"M40 62h16M108 32h24v12M184 62h16\" opacity=\".45\"/>"
  },
  "warwick-castle": {
    "label": "Warwick Castle",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V48h64v24\" stroke-width=\"1.35\"/><path d=\"M8 48h64\"/><path d=\"M10 48v-5h6v5M22 48v-5h6v5M46 48v-5h6v5M58 48v-5h6v5\" stroke-width=\"1.1\"/><circle cx=\"28\" cy=\"40\" r=\"8\" stroke-width=\"1.3\"/><circle cx=\"52\" cy=\"40\" r=\"8\" stroke-width=\"1.3\"/><path d=\"M28 32V26M52 32V26\" stroke-width=\"1.15\"/><path d=\"M36 72V58h8v14\" opacity=\".55\" stroke-width=\"1.15\"/>",
    "hero": "<path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V48h192v34\" stroke-width=\"2\"/><path d=\"M24 48h192\"/><path d=\"M32 48v-8h12v8M56 48v-8h12v8M160 48v-8h12v8M184 48v-8h12v8\"/><circle cx=\"80\" cy=\"40\" r=\"16\"/><circle cx=\"160\" cy=\"40\" r=\"16\"/><path d=\"M80 24V16M160 24V16\"/><path d=\"M104 82V58h32v24\" opacity=\".55\"/>"
  },
  "iron-bridge": {
    "label": "The Iron Bridge",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><path d=\"M8 72V48h12v24M60 72V48h12v24\" stroke-width=\"1.35\"/><path d=\"M8 56h12M8 64h12M60 56h12M60 64h12\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M14 50c8-28 44-28 52 0\" stroke-width=\"1.7\"/><path d=\"M18 50c6-20 38-20 44 0\" opacity=\".5\" stroke-width=\"1.1\"/><path d=\"M10 46h60\" stroke-width=\"1.5\"/><path d=\"M14 42h52\" opacity=\".7\" stroke-width=\"1.1\"/><path d=\"M20 42v4M28 42v4M36 42v4M44 42v4M52 42v4M60 42v4\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M24 48l4-6M32 50l4-12M40 50V36M48 50l-4-12M56 48l-4-6\" opacity=\".5\" stroke-width=\"1\"/><circle cx=\"24\" cy=\"47\" r=\"2.2\" opacity=\".65\" stroke-width=\"1\"/><circle cx=\"56\" cy=\"47\" r=\"2.2\" opacity=\".65\" stroke-width=\"1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M28 82V52h28v30M184 82V52h28v30\"/><path d=\"M28 62h28M28 72h28M184 62h28M184 72h28\" opacity=\".35\"/><path d=\"M42 54c28-42 128-42 156 0\" stroke-width=\"2.2\"/><path d=\"M54 54c22-30 110-30 132 0\" opacity=\".5\"/><path d=\"M36 48h168\" stroke-width=\"2\"/><path d=\"M44 42h152\" opacity=\".7\"/><path d=\"M56 42v6M80 42v6M104 42v6M128 42v6M152 42v6M176 42v6\" opacity=\".45\"/><path d=\"M70 50l8-10M96 52l8-16M120 52V34M144 52l-8-16M170 50l-8-10\" opacity=\".5\"/><circle cx=\"62\" cy=\"50\" r=\"5\" opacity=\".6\"/><circle cx=\"178\" cy=\"50\" r=\"5\" opacity=\".6\"/>"
  },
  "online-events": {
    "label": "Online events",
    "chip": "<path d=\"M8 72h64\" opacity=\".35\" stroke-width=\"1.1\"/><rect x=\"18\" y=\"22\" width=\"44\" height=\"32\" rx=\"2\" stroke-width=\"1.45\"/><rect x=\"22\" y=\"26\" width=\"36\" height=\"24\" rx=\"1\" opacity=\".45\" stroke-width=\"1\"/><circle cx=\"40\" cy=\"38\" r=\"9\" stroke-width=\"1.25\"/><ellipse cx=\"40\" cy=\"38\" rx=\"9\" ry=\"3.5\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M31 38h18M40 29v18\" opacity=\".45\" stroke-width=\"1\"/><path d=\"M33 32c3 2 6 3 7 3s4-1 7-3M33 44c3-2 6-3 7-3s4 1 7 3\" opacity=\".4\" stroke-width=\"1\"/><path d=\"M30 58h20\" stroke-width=\"1.35\"/><path d=\"M40 54v4M36 58h8\" stroke-width=\"1.25\"/><path d=\"M52 30c4 2 7 5 9 9M52 46c4-2 7-5 9-9\" opacity=\".45\" stroke-width=\"1.1\"/><path d=\"M56 34c2 1 3 3 3 4M56 42c2-1 3-3 3-4\" opacity=\".45\" stroke-width=\"1.1\"/>",
    "hero": "<path d=\"M20 82h200\" opacity=\".35\"/><rect x=\"56\" y=\"16\" width=\"128\" height=\"56\" rx=\"3\" stroke-width=\"2\"/><rect x=\"64\" y=\"24\" width=\"112\" height=\"40\" rx=\"2\" opacity=\".45\"/><circle cx=\"120\" cy=\"44\" r=\"16\" stroke-width=\"1.8\"/><ellipse cx=\"120\" cy=\"44\" rx=\"16\" ry=\"6\" opacity=\".45\"/><path d=\"M96 44h48M120 28v32\" opacity=\".45\"/><path d=\"M88 82h64\" stroke-width=\"2\"/><path d=\"M120 74v8M108 82h24\"/>"
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
  "cheshire": "chester",
  "lancashire": "blackpool-tower",
  "surrey": "hampton-court",
  "kent": "canterbury-cathedral",
  "hampshire": "spinnaker-tower",
  "essex": "southend-pier",
  "hertfordshire": "st-albans-abbey",
  "berkshire": "reading-blade",
  "oxfordshire": "oxford",
  "buckinghamshire": "stowe-arch",
  "cambridgeshire": "cambridge",
  "sussex": "brighton",
  "shropshire": "iron-bridge",
  "devon": "smeaton-tower",
  "dorset": "corfe-castle",
  "norfolk": "norwich-cathedral",
  "staffordshire": "lichfield-cathedral",
  "warwickshire": "warwick-castle",
  "yorkshire": "york-minster",
  "liverpool": "liverpool",
  "newcastle": "newcastle",
  "sheffield": "sheffield",
  "nottingham": "nottingham",
  "cardiff": "cardiff",
  "brighton": "brighton",
  "cambridge": "cambridge",
  "oxford": "oxford",
  "belfast": "belfast-city-hall",
  "reading": "reading-blade",
  "leicester": "leicester-clock-tower",
  "bournemouth": "bournemouth-pier",
  "online": "online-events"
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
