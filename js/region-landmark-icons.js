/**
 * Single-landmark SVG marks for UK networking regions (chip + hero sizes).
 * Keep in sync with api/_lib/region-landmark-icons.js
 */
(function (global) {
  function chipSvg(paths) {
    return (
      '<svg class="region-landmark-chip" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  function heroSvg(paths) {
    return (
      '<svg class="networking-region-landmark-svg" viewBox="0 0 200 72" fill="currentColor" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  var LANDMARKS =   {
      "big-ben": {
          "label": "Big Ben",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M19 42V15h10v27H19z\"/><path d=\"M21 15V9h6v6\"/><path d=\"M22 19h4v9h-4z\" opacity=\".45\"/><path d=\"M24 5.5v3.5\"/><path d=\"M22.5 7.5h3\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M78 68V14h44v54H78z\"/><path d=\"M86 14V4h28v10\"/><path d=\"M92 24h20v22H92z\" opacity=\".45\"/><path d=\"M100 2v8M94 10h12\"/>"
      },
      "alexandra-palace": {
          "label": "Alexandra Palace",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M8 42V29h7v13M15 42V24h3v18M18 42V20h12v22M30 42V24h3v18M33 42V29h7v13\"/><path d=\"M18 20c0-5 2.5-9 6-9s6 4 6 9\"/><ellipse cx=\"24\" cy=\"15\" rx=\"5.5\" ry=\"3.5\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M36 66V38h28v28M72 66V24h18v42M90 66V18h44v48M134 66V24h18v42M152 66V38h28v28\"/><path d=\"M90 18c0-14 8-22 22-22s22 8 22 22\"/><ellipse cx=\"112\" cy=\"22\" rx=\"22\" ry=\"12\"/>"
      },
      "o2-arena": {
          "label": "The O2 Arena",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M10 42c0-12 5.5-20 14-20s14 8 14 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"/><path d=\"M24 6v5\"/><path d=\"M13 30l-2.5-4.5M35 30l2.5-4.5M17 23l-3.5-3M31 23l3.5-3M20 17l-1.5-4.5M28 17l1.5-4.5\" stroke=\"currentColor\" stroke-width=\"1.3\" fill=\"none\" stroke-linecap=\"round\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M48 66c0-34 20-54 52-54s52 20 52 54\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\"/><path d=\"M100 8v14\"/><path d=\"M58 48l-8-14M142 48l8-14M68 34l-10-10M132 34l10-10M78 22l-5-12M122 22l5-12\" stroke=\"currentColor\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/>"
      },
      "tower-bridge": {
          "label": "Tower Bridge",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M10 42V20h6v22M32 42V20h6v22\"/><path d=\"M8 20h10v4H8zm22 0h10v4H30z\"/><path d=\"M16 24h16v3H16z\"/><path d=\"M18 20V14h3v6M27 20V14h3v6\"/>",
          "hero": "<path d=\"M20 66h160\" opacity=\".35\"/><path d=\"M36 66V28h24v38M140 66V28h24v38\"/><path d=\"M28 28h40v12H28zm104 0h40v12H132z\"/><path d=\"M56 40h88v8H56z\"/><path d=\"M64 28V12h12v16M124 28V12h12v16\"/>"
      },
      "west-london-w": {
          "label": "West London",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M6 22h3.5M6 27h3.5M6 32h3.5M38.5 22H42M38.5 27H42M38.5 32H42\" stroke=\"currentColor\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M15 42l4.5-16 3.5 10 3.5-10L31 42\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M28 30h10M28 40h10M28 50h10M162 30h10M162 40h10M162 50h10\" stroke=\"currentColor\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M62 66l18-48 14 30 14-30 18 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5.5\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>"
      },
      "manchester": {
          "label": "Beetham Tower",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M21 42V7h6v35\"/><path d=\"M19.5 42h9\"/><path d=\"M22.5 12h3v5h-3z\" opacity=\".4\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M88 66V8h44v58\"/><path d=\"M82 66h56\"/><path d=\"M94 22h32v14H94z\" opacity=\".4\"/>"
      },
      "birmingham": {
          "label": "Birmingham Bull",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M14 17c-3.5-5.5-1.5-9 2-7s2 5.5-2 7M34 17c3.5-5.5 1.5-9-2-7s-2 5.5 2 7\"/><path d=\"M12 21c0 11 5.5 19 12 19s12-8 12-19c0-5.5-3.5-9.5-8-9.5h-8c-4.5 0-8 4-8 9.5z\"/><path d=\"M21 30h6v5h-6z\" opacity=\".45\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M58 28c-14-22-6-36 8-28s8 28-8 28M142 28c14-22 6-36-8-28s-8 28 8 28\"/><path d=\"M48 38c0 28 14 48 52 48s52-20 52-48c0-14-10-24-22-24H70c-12 0-22 10-22 24z\"/><path d=\"M88 58h24v14H88z\" opacity=\".45\"/>"
      },
      "glasgow": {
          "label": "Finnieston Crane",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M14 42V12h2.5v30\"/><path d=\"M8 12h28v3H8z\"/><path d=\"M30 15v18\"/><path d=\"M28 42h5\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M52 66V22h10v44\"/><path d=\"M28 22h96v8H28z\"/><path d=\"M112 30v36\"/><path d=\"M104 66h16\"/>"
      },
      "edinburgh": {
          "label": "Edinburgh Castle",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M8 42c5-10 10-15 16-15s11 5 16 15\"/><path d=\"M12 42V30h4v12M18 42V26h4v16M24 42V22h4v20M28 42V26h4v16M34 42V30h4v12\"/><path d=\"M22 18l-2.5 3h5l-2.5-3z\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M32 66c16-28 40-42 68-42s52 14 68 42\"/><path d=\"M52 52h16v14H52zm32-18h16v32H84zm32 6h16v26h-16z\"/><path d=\"M84 18l-8 10h16l-8-10z\"/>"
      },
      "leeds": {
          "label": "Leeds Corn Exchange",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M8 42V26l4-9 4 9v16M18 42V22l4-11 4 11v20M28 42V24l4-9 4 9v18M38 42V28l4-9 4 9v14\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M32 66V38l16-36 16 36v28M80 66V28l16-40 16 40v38M128 66V42l16-32 16 32v24\"/>"
      },
      "liverpool": {
          "label": "Royal Liver Building",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M11 42V18h7v24M30 42V12h7v30\"/><path d=\"M13 18h3v4h-3zm16 0h3v4h-3z\"/><path d=\"M14.5 13l1.5-4 1.5 4M32.5 9l1.5-4 1.5 4\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M36 66V24h36v42M128 66V10h36v56\"/><path d=\"M44 24h20v14H44zm84 0h20v14h-20z\"/><path d=\"M48 14l6-12 6 12M140 6l6-12 6 12\"/>"
      },
      "newcastle": {
          "label": "Tyne Bridge",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M10 42V24h5v18M33 42V24h5v18\"/><path d=\"M8 24c8-10 16-10 24 0s16 10 24 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M15 30h18v2.5H15z\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M28 66V34h32v32M140 66V34h32v32\"/><path d=\"M20 34c60-40 120-40 180 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M52 48h96v8H52z\"/>"
      },
      "bristol": {
          "label": "Clifton Suspension Bridge",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M6 28c9-10 19-10 28 0s19 10 28 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M8 42V26h4v16M36 42V26h4v16\"/>",
          "hero": "<path d=\"M16 38c56-36 112-36 168 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M24 66V22h20v44M156 66V22h20v44\"/><path d=\"M16 66h168\" opacity=\".35\"/>"
      },
      "sheffield": {
          "label": "Sheffield Steelworks",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M10 42V30h7v12M21 42V22h5v20M30 42V32h7v10\"/><path d=\"M12 24v7h2v-7M14 20v11h2v-11M23 16v8h2v-8M32 26v7h2v-7\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M32 66V38h28v28M76 66V22h20v44M112 66V48h28v18\"/><path d=\"M38 28v14h4v-14M44 20v22h4v-22M82 14v18h4v-18M118 34v14h4v-14\"/>"
      },
      "nottingham": {
          "label": "Nottingham Castle",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M8 42c4-9 9-14 16-14s12 5 16 14\"/><path d=\"M12 42V31h4v11M20 42V27h4v15M28 42V27h4v15M36 42V31h4v11\"/><path d=\"M22 17l-2.5 3h5l-2.5-3z\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M32 66c16-26 40-38 68-38s52 12 68 38\"/><path d=\"M52 52h16v14H52zm32-16h16v30H84zm32 4h16v26h-16z\"/><path d=\"M84 16l-8 10h16l-8-10z\"/>"
      },
      "cardiff": {
          "label": "Principality Stadium",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><ellipse cx=\"24\" cy=\"26\" rx=\"15\" ry=\"9\"/><path d=\"M9 26h30\"/><path d=\"M11 42V26M37 42V26\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><ellipse cx=\"100\" cy=\"32\" rx=\"58\" ry=\"24\"/><path d=\"M42 32h116\"/><path d=\"M48 66V32M152 66V32\"/>"
      },
      "brighton": {
          "label": "Royal Pavilion",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M12 42V28c2-7 5-11 12-11s10 4 12 11v14\"/><path d=\"M15 28h18\" opacity=\".5\"/><path d=\"M20 22c0-3 2-5 4-5s4 2 4 5\"/>",
          "hero": "<path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M48 66V28c8-24 24-36 52-36s44 12 52 36v38\"/><path d=\"M56 28h88\" opacity=\".5\"/><path d=\"M68 14c0-10 12-18 32-18s32 8 32 18\"/>"
      },
      "cambridge": {
          "label": "King's College Chapel",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M12 42V22h24v20\"/><path d=\"M14 22V14h6v8M28 22V14h6v8\"/><path d=\"M22 8v6\"/><path d=\"M17 30h14v3H17z\" opacity=\".45\"/>",
          "hero": "<path d=\"M32 66h136\" opacity=\".35\"/><path d=\"M48 66V18h104v48\"/><path d=\"M56 18V8h24v10M120 18V8h24v10\"/><path d=\"M100 2v12\"/><path d=\"M68 36h64v10H68z\" opacity=\".45\"/>"
      },
      "oxford": {
          "label": "Radcliffe Camera",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><circle cx=\"24\" cy=\"24\" r=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M15 42V30h18v12\"/><path d=\"M24 10v4\"/>",
          "hero": "<path d=\"M32 66h136\" opacity=\".35\"/><circle cx=\"100\" cy=\"30\" r=\"34\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\"/><path d=\"M66 66V38h68v28\"/><path d=\"M100 4v10\"/>"
      },
      "chester": {
          "label": "Eastgate Clock",
          "chip": "<path d=\"M4 42h40\" opacity=\".28\"/><path d=\"M14 42V20h20v22\"/><path d=\"M16 20h16v5H16z\"/><circle cx=\"24\" cy=\"26\" r=\"3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\"/><path d=\"M22 42V36h4v6\"/>",
          "hero": "<path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M64 66V24h72v42\"/><path d=\"M72 24h56v14H72z\"/><circle cx=\"100\" cy=\"40\" r=\"10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"/><path d=\"M88 66V52h24v14\"/>"
      }
  };

  var LANDMARK_BY_REGION =   {
      "central-london": "big-ben",
      "north-london": "alexandra-palace",
      "south-london": "o2-arena",
      "east-london": "tower-bridge",
      "west-london": "west-london-w",
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
