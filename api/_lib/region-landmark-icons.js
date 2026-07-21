/**
 * Architectural line-drawing landmark marks for UK networking regions.
 * Fine structural lines, windows, trusses, and light hand-sketch shading.
 * Keep browser copy in sync: js/region-landmark-icons.js
 */

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

/** Fine hatch / window helpers as path snippets (chip scale). */
const HATCH = {
  ground: '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>',
  winRow: (x, y, n, gap, w, h) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      s += `<rect x="${x + i * gap}" y="${y}" width="${w}" height="${h}" opacity=".55" stroke-width="1"/>`;
    }
    return s;
  },
};

/** @type {Record<string, { chip: string, hero: string, label: string }>} */
const LANDMARKS = {
  'big-ben': {
    label: 'Big Ben',
    chip:
      HATCH.ground +
      // shaft
      '<rect x="28" y="22" width="24" height="50"/>' +
      // stone courses
      '<path d="M28 34h24M28 46h24M28 58h24" opacity=".35" stroke-width="1"/>' +
      // belfry / clock section
      '<rect x="30" y="10" width="20" height="14"/>' +
      // clock face
      '<circle cx="40" cy="17" r="5.5" stroke-width="1.2"/>' +
      '<path d="M40 17v-3.5M40 17l3 2" stroke-width="1.1"/>' +
      // spire
      '<path d="M36 10V6h8v4"/>' +
      '<path d="M40 3v3M37 5h6" stroke-width="1.2"/>' +
      // windows
      '<rect x="33" y="38" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      '<rect x="42" y="38" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      '<rect x="33" y="50" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      '<rect x="42" y="50" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      // corner buttresses
      '<path d="M28 72V28M52 72V28" opacity=".4" stroke-width="1"/>' +
      // shading hatch on right face
      '<path d="M48 28l4 4M48 36l4 4M48 44l4 4M48 52l4 4M48 60l4 4" opacity=".28" stroke-width=".9"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><rect x="96" y="18" width="48" height="64"/><path d="M96 34h48M96 50h48M96 66h48" opacity=".35"/><rect x="102" y="4" width="36" height="18"/><circle cx="120" cy="13" r="8"/><path d="M120 13v-5M120 13l4 3"/><path d="M110 4V0h20v4"/><path d="M120-2v2"/><rect x="106" y="42" width="8" height="10" opacity=".5"/><rect x="126" y="42" width="8" height="10" opacity=".5"/><path d="M140 24l6 6M140 36l6 6M140 48l6 6M140 60l6 6" opacity=".3"/>',
  },
  'alexandra-palace': {
    label: 'Alexandra Palace',
    chip:
      HATCH.ground +
      // wings
      '<path d="M6 72V48h14v24M60 72V48h14v24"/>' +
      // mid wings
      '<path d="M18 72V40h10v32M52 72V40h10v32"/>' +
      // central hall
      '<path d="M26 72V36h28v36"/>' +
      // central dome
      '<path d="M30 36c0-12 4-18 10-18s10 6 10 18"/>' +
      '<ellipse cx="40" cy="24" rx="11" ry="6"/>' +
      '<path d="M40 12v6" stroke-width="1.2"/>' +
      // arcade windows
      '<path d="M10 56h6M10 62h6M64 56h6M64 62h6" opacity=".45" stroke-width="1"/>' +
      '<path d="M30 48h4v8M36 48h4v8M42 48h4v8M48 48h4v8" opacity=".5" stroke-width="1"/>' +
      // roof ridge detail
      '<path d="M26 36h28" opacity=".45"/>' +
      // shading
      '<path d="M50 40l4 3M50 48l4 3M50 56l4 3M50 64l4 3" opacity=".25" stroke-width=".9"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M24 82V52h36v30M180 82V52h36v30"/><path d="M52 82V40h28v42M160 82V40h28v42"/><path d="M72 82V32h96v50"/><path d="M84 32c0-20 10-28 28-28s28 8 28 28"/><ellipse cx="112" cy="18" rx="30" ry="12"/><path d="M112 2v8"/><path d="M88 52h8v14M104 52h8v14M120 52h8v14M136 52h8v14" opacity=".5"/>',
  },
  'o2-arena': {
    label: 'The O2 Arena',
    chip:
      HATCH.ground +
      // dome shell
      '<path d="M12 72c0-28 10-44 28-44s28 16 28 44" stroke-width="1.6"/>' +
      // rib lines
      '<path d="M20 70c2-22 8-34 20-34M40 36c12 0 18 12 20 34M28 70c1-18 5-28 12-30M52 70c-1-18-5-28-12-30" opacity=".4" stroke-width="1"/>' +
      // yellow masts / spikes
      '<path d="M40 10v14" stroke-width="1.5"/>' +
      '<path d="M18 52l-8-14M62 52l8-14M24 40l-8-10M56 40l8-10M30 28l-4-12M50 28l4-12" stroke-width="1.25"/>' +
      // base ring
      '<path d="M14 68h52" opacity=".4" stroke-width="1"/>' +
      // hatch shading under dome
      '<path d="M22 58h8M30 62h10M42 58h8" opacity=".22" stroke-width=".9"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M40 82c0-42 26-64 80-64s80 22 80 64" stroke-width="2.2"/><path d="M60 78c4-34 16-50 40-50M120 28c24 0 36 16 40 50M80 78c2-26 10-40 20-42M160 78c-2-26-10-40-20-42" opacity=".4"/><path d="M120 8v18M52 58l-14-22M188 58l14-22M68 42l-12-16M172 42l12-16M88 26l-6-16M152 26l6-16" stroke-width="1.8"/>',
  },
  'tower-bridge': {
    label: 'Tower Bridge',
    chip:
      HATCH.ground +
      // towers
      '<path d="M12 72V28h14v44M54 72V28h14v44"/>' +
      // tower tops / turrets
      '<path d="M10 28h18v8H10zM52 28h18v8H52z"/>' +
      '<path d="M14 28V18h4v10M22 28V18h4v10M56 28V18h4v10M64 28V18h4v10"/>' +
      '<path d="M16 18l2-5 2 5M24 18l2-5 2 5M58 18l2-5 2 5M66 18l2-5 2 5"/>' +
      // high walkways
      '<path d="M26 32h28M26 36h28" stroke-width="1.3"/>' +
      // walkway truss diagonals
      '<path d="M28 32l4 4M36 32l4 4M44 32l4 4M32 36l-4-4M40 36l-4-4M48 36l-4-4" opacity=".45" stroke-width="1"/>' +
      // bascule bridge deck
      '<path d="M26 48h28" stroke-width="1.5"/>' +
      '<path d="M26 48l14-4 14 4" opacity=".55" stroke-width="1.1"/>' +
      // tower windows
      '<rect x="16" y="40" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      '<rect x="16" y="54" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      '<rect x="59" y="40" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      '<rect x="59" y="54" width="5" height="7" opacity=".5" stroke-width="1"/>' +
      // stone hatch
      '<path d="M22 40l4 3M22 50l4 3M22 60l4 3" opacity=".25" stroke-width=".85"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M36 82V28h36v54M168 82V28h36v54"/><path d="M30 28h48v12H30zM162 28h48v12H162z"/><path d="M42 28V12h8v16M58 28V12h8v16M174 28V12h8v16M190 28V12h8v16"/><path d="M72 36h96M72 42h96"/><path d="M78 36l8 6M96 36l8 6M114 36l8 6M132 36l8 6M86 42l-8-6M104 42l-8-6M122 42l-8-6M140 42l-8-6" opacity=".45"/><path d="M72 56h96" stroke-width="2"/><rect x="46" y="48" width="10" height="12" opacity=".5"/><rect x="184" y="48" width="10" height="12" opacity=".5"/>',
  },
  battersea: {
    label: 'Battersea Power Station',
    chip:
      HATCH.ground +
      // main blocks
      '<path d="M10 72V40h16v32M26 72V34h14v38M40 72V40h16v32M56 72V44h14v28"/>' +
      // chimneys
      '<path d="M14 40V18h5v22M32 34V14h5v20M46 40V18h5v22M62 44V22h5v22"/>' +
      // chimney tops / caps
      '<path d="M13 18h7M31 14h7M45 18h7M61 22h7" stroke-width="1.3"/>' +
      // windows rows
      HATCH.winRow(13, 48, 2, 6, 4, 6) +
      HATCH.winRow(29, 44, 2, 6, 4, 6) +
      HATCH.winRow(43, 48, 2, 6, 4, 6) +
      HATCH.winRow(59, 52, 2, 6, 4, 6) +
      // brick courses
      '<path d="M10 56h60M10 64h60" opacity=".3" stroke-width="1"/>' +
      // shading
      '<path d="M66 48l4 3M66 56l4 3M66 64l4 3" opacity=".25" stroke-width=".9"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M32 82V40h40v42M80 82V28h40v54M128 82V40h40v42M176 82V48h32v34"/><path d="M44 40V12h12v28M96 28V6h12v22M144 40V12h12v28M188 48V20h12v28"/><path d="M42 12h16M94 6h16M142 12h16M186 20h16"/><path d="M40 56h16v10H40zM92 48h16v10H92zM136 56h16v10h-16z" opacity=".5"/>',
  },
  manchester: {
    label: 'Beetham Tower',
    chip:
      HATCH.ground +
      // main shaft
      '<path d="M32 72V22h16v50" stroke-width="1.6"/>' +
      // distinctive blade / beacon overhang
      '<path d="M34 22V6h12v16" stroke-width="1.5"/>' +
      '<path d="M30 22h20" stroke-width="1.6"/>' +
      '<path d="M40 3v3" stroke-width="1.3"/>' +
      // glazing grid
      '<path d="M32 30h16M32 38h16M32 46h16M32 54h16M32 62h16" opacity=".4" stroke-width="1"/>' +
      '<path d="M37 22v50M43 22v50" opacity=".32" stroke-width="1"/>' +
      // podium
      '<path d="M26 72h28" stroke-width="1.6"/>' +
      '<path d="M46 26l4 3M46 42l4 3M46 58l4 3" opacity=".25" stroke-width=".85"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M104 82V24h32v58"/><path d="M108 24V4h24v20"/><path d="M98 24h44" stroke-width="2"/><path d="M104 36h32M104 48h32M104 60h32M104 72h32" opacity=".4"/><path d="M114 24v58M126 24v58" opacity=".35"/><path d="M90 82h60" stroke-width="2"/>',
  },
  birmingham: {
    label: 'Birmingham Bull',
    chip:
      HATCH.ground +
      // large crescent horns (Bullring statue scale)
      '<path d="M30 32C12 30 6 16 14 4c0 10 6 18 16 24" fill="none" stroke-width="2.3"/>' +
      '<path d="M50 32C68 30 74 16 66 4c0 10-6 18-16 24" fill="none" stroke-width="2.3"/>' +
      // pointed bovine ears
      '<path d="M26 36l-8 2 2 8 8-4M54 36l8 2-2 8-8-4" stroke-width="1.35"/>' +
      // blocky forehead
      '<path d="M28 30h24l2 8H26z" stroke-width="1.45"/>' +
      // heavy head tapering to muzzle
      '<path d="M26 38c-1 10 2 20 8 26h12c6-6 9-16 8-26" stroke-width="1.55"/>' +
      // brow ridge + eyes
      '<path d="M28 40h24" opacity=".5"/>' +
      '<circle cx="34" cy="44" r="1.7" stroke-width="1.2"/>' +
      '<circle cx="46" cy="44" r="1.7" stroke-width="1.2"/>' +
      // wide snout + nostrils
      '<path d="M32 54h16v10H32z" stroke-width="1.4"/>' +
      '<path d="M36 58v3M44 58v3" stroke-width="1.35"/>' +
      // nose ring
      '<circle cx="40" cy="66" r="4.2" stroke-width="1.5"/>' +
      '<path d="M40 61.8v-1.3" stroke-width="1.2"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/>' +
      '<path d="M90 38C54 34 42 10 56-4c0 20 14 36 34 46M150 38c36-4 48-28 34-42 0 20-14 36-34 46" stroke-width="3"/>' +
      '<path d="M84 44l-14 4 4 14 14-8M156 44l14 4-4 14-14-8"/>' +
      '<path d="M88 36h64l4 14H84z"/><path d="M84 50c-2 18 4 34 16 44h40c12-10 18-26 16-44"/>' +
      '<circle cx="104" cy="58" r="4"/><circle cx="136" cy="58" r="4"/>' +
      '<path d="M100 70h40v16H100z"/><path d="M110 76v5M130 76v5" stroke-width="2"/>' +
      '<circle cx="120" cy="92" r="9"/><path d="M120 83v-4"/>',
  },
  glasgow: {
    label: 'Finnieston Crane',
    chip:
      HATCH.ground +
      // mast
      '<path d="M22 72V18h6v54" stroke-width="1.6"/>' +
      // lattice on mast
      '<path d="M22 28l6 6M22 40l6 6M22 52l6 6M28 28l-6 6M28 40l-6 6M28 52l-6 6" opacity=".45" stroke-width="1"/>' +
      // jib boom
      '<path d="M12 18h52v6H12z" stroke-width="1.5"/>' +
      // jib truss
      '<path d="M16 18l8 6M28 18l8 6M40 18l8 6M52 18l6 6M20 24l-4-6M32 24l-4-6M44 24l-4-6M56 24l-4-6" opacity=".5" stroke-width="1"/>' +
      // hook / cable
      '<path d="M54 24v28" stroke-width="1.2"/>' +
      '<path d="M50 52h8M52 56h4" stroke-width="1.2"/>' +
      // counterweight
      '<path d="M12 18v10h8" opacity=".55"/>' +
      // base
      '<path d="M16 72h20" stroke-width="1.5"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M56 82V20h14v62"/><path d="M56 34l14 10M56 50l14 10M56 66l14 10M70 34l-14 10M70 50l-14 10M70 66l-14 10" opacity=".45"/><path d="M36 20h140v12H36z"/><path d="M48 20l16 12M80 20l16 12M112 20l16 12M144 20l16 12M64 32l-16-12M96 32l-16-12M128 32l-16-12M160 32l-16-12" opacity=".5"/><path d="M156 32v36"/><path d="M148 68h16"/>',
  },
  edinburgh: {
    label: 'Edinburgh Castle',
    chip:
      HATCH.ground +
      // Castle Rock — steep crag with flat summit
      '<path d="M6 72L14 54l8 6 10-22 8 4 10-18 8 8 10-10 8 12 8 20v18H6z" stroke-width="1.55"/>' +
      // rock strata
      '<path d="M16 62l6-4 8 2M34 50l8-3 10 2M50 44l6-2" opacity=".35" stroke-width="1"/>' +
      // curtain wall along summit
      '<path d="M24 40h34" stroke-width="1.6"/>' +
      // left tower
      '<path d="M24 40V26h10v14" stroke-width="1.45"/>' +
      '<path d="M24 26h2v-3h2v3h2v-3h2v3h2" stroke-width="1.2"/>' +
      // central keep (taller)
      '<path d="M34 40V18h14v22" stroke-width="1.5"/>' +
      '<path d="M34 18h2v-3h2v3h2v-3h2v3h2v-3h2v3h2" stroke-width="1.2"/>' +
      // right tower
      '<path d="M48 40V28h10v12" stroke-width="1.45"/>' +
      '<path d="M48 28h2v-3h2v3h2v-3h2v3h2" stroke-width="1.2"/>' +
      // flag on keep
      '<path d="M41 15V6" stroke-width="1.3"/>' +
      '<path d="M41 6h8l-2.5 2.5L49 11H41z" stroke-width="1.15"/>' +
      // arrow slits
      '<path d="M28 32h3v4M40 26h4v5M52 33h3v4" opacity=".5" stroke-width="1"/>' +
      // cliff hatch
      '<path d="M20 58l3 4M36 48l3 4M54 52l3 4" opacity=".28" stroke-width=".9"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/>' +
      '<path d="M24 82L40 56l16 10 20-36 16 8 24-32 16 14 20-18 16 20 20 40v20H24z" stroke-width="2"/>' +
      '<path d="M72 48h96" stroke-width="2.2"/>' +
      '<path d="M72 48V28h24v20M96 48V16h40v32M136 48V30h28v18"/>' +
      '<path d="M72 28h3v-5h4v5h4v-5h4v5h5"/><path d="M96 16h4v-5h5v5h5v-5h5v5h5v-5h5v5h6"/><path d="M136 30h3v-5h4v5h4v-5h4v5h5"/>' +
      '<path d="M116 16V2M116 2h14l-4 4 4 4h-14"/><path d="M84 36h6v8M112 28h8v10M148 36h6v8" opacity=".5"/>',
  },
  leeds: {
    label: 'Leeds Town Hall',
    chip:
      HATCH.ground +
      // classical base / colonnade
      '<path d="M10 72V48h60v24" stroke-width="1.45"/>' +
      '<path d="M14 48v16M22 48v16M30 48v16M50 48v16M58 48v16M66 48v16" opacity=".45" stroke-width="1.1"/>' +
      // pediment
      '<path d="M10 48l30-10 30 10" stroke-width="1.45"/>' +
      // giant clock tower
      '<path d="M30 38V12h20v26" stroke-width="1.55"/>' +
      '<circle cx="40" cy="22" r="6" stroke-width="1.3"/>' +
      '<path d="M40 22v-4M40 22l3 2" stroke-width="1.1"/>' +
      // tower crown / dome
      '<path d="M32 12h16l-2-5H34z" stroke-width="1.3"/>' +
      '<path d="M40 7V3" stroke-width="1.25"/>' +
      // base steps
      '<path d="M8 72h64M12 68h56" opacity=".4" stroke-width="1"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M36 82V52h168v30"/><path d="M48 52v28M72 52v28M96 52v28M144 52v28M168 52v28M192 52v28" opacity=".45"/><path d="M36 52l84-22 84 22"/><path d="M100 40V10h40v30"/><circle cx="120" cy="24" r="10"/><path d="M120 24v-6M120 24l5 3"/><path d="M104 10h32l-4-8h-24z"/><path d="M120 2v-4"/>',
  },
  liverpool: {
    label: 'Royal Liver Building',
    chip:
      HATCH.ground +
      // twin clock towers
      '<path d="M12 72V34h18v38M50 72V26h18v46" stroke-width="1.5"/>' +
      // clock faces
      '<circle cx="21" cy="44" r="5.5" stroke-width="1.25"/>' +
      '<circle cx="59" cy="38" r="5.5" stroke-width="1.25"/>' +
      '<path d="M21 44v-3.5M59 38v-3.5" stroke-width="1.1"/>' +
      // Liver Birds
      '<path d="M16 30c0-6 3-10 5-10 1 0 2 2 3 4l2-6c2 4 3 8 2 12" stroke-width="1.3"/>' +
      '<path d="M18 24l4 2M22 20l3-2" stroke-width="1.1"/>' +
      '<path d="M54 22c0-6 3-10 5-10 1 0 2 2 3 4l2-6c2 4 3 8 2 12" stroke-width="1.3"/>' +
      '<path d="M56 16l4 2M60 12l3-2" stroke-width="1.1"/>' +
      // mid block
      '<path d="M30 58h20v14H30z" stroke-width="1.35"/>' +
      '<path d="M16 54h10M16 62h10M54 48h10M54 56h10M54 64h10" opacity=".4" stroke-width="1"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M40 82V28h40v54M160 82V16h40v66"/><circle cx="60" cy="42" r="10"/><circle cx="180" cy="32" r="10"/><path d="M48 20c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22"/><path d="M168 8c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22"/><path d="M80 62h80v20H80z"/><path d="M48 56h24M48 68h24M168 48h24M168 60h24" opacity=".4"/>',
  },
  newcastle: {
    label: 'Tyne Bridge',
    chip:
      HATCH.ground +
      // piers
      '<path d="M10 72V40h10v32M60 72V40h10v32"/>' +
      // main arch
      '<path d="M8 40c16-24 32-24 48 0 16 24 32 24 48 0" stroke-width="1.8"/>' +
      // arch thickness (inner)
      '<path d="M14 42c12-16 24-16 36 0" opacity=".45" stroke-width="1.1"/>' +
      // deck
      '<path d="M20 50h40" stroke-width="1.6"/>' +
      // hangers / suspenders
      '<path d="M24 42v8M32 36v14M40 36v14M48 42v8" opacity=".55" stroke-width="1"/>' +
      // deck truss
      '<path d="M22 50l4 4h28l4-4M26 54l4-4 4 4 4-4 4 4 4-4 4 4" opacity=".4" stroke-width="1"/>' +
      // pier detail
      '<path d="M12 52h6M12 60h6M62 52h6M62 60h6" opacity=".4" stroke-width="1"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M28 82V40h32v42M180 82V40h32v42"/><path d="M20 40c56-40 112-40 168 0" stroke-width="2.4"/><path d="M40 44c40-28 80-28 120 0" opacity=".45"/><path d="M48 54h144" stroke-width="2"/><path d="M60 42v12M90 32v22M120 32v22M150 32v22M180 42v12" opacity=".55"/>',
  },
  bristol: {
    label: 'Clifton Suspension Bridge',
    chip:
      HATCH.ground +
      // towers
      '<path d="M12 72V34h10v38M58 72V34h10v38"/>' +
      // tower arches / openings
      '<path d="M14 48h6v10H14zM60 48h6v10H60z" opacity=".5" stroke-width="1"/>' +
      // main cables
      '<path d="M8 38c16-18 32-18 48 0s32 18 48 0" stroke-width="1.6"/>' +
      // secondary cable
      '<path d="M12 42c12-12 24-12 36 0s24 12 36 0" opacity=".45" stroke-width="1.1"/>' +
      // deck
      '<path d="M22 48h36" stroke-width="1.5"/>' +
      // suspenders
      '<path d="M26 36v12M32 32v16M40 32v16M48 36v12" opacity=".5" stroke-width="1"/>' +
      // tower tops
      '<path d="M12 34h10M58 34h10" stroke-width="1.3"/>' +
      '<path d="M17 34v-4M63 34v-4" stroke-width="1.2"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M32 82V28h28v54M180 82V28h28v54"/><path d="M24 36c48-32 96-32 144 0" stroke-width="2.2"/><path d="M36 44c36-20 72-20 108 0" opacity=".45"/><path d="M60 52h120" stroke-width="2"/><path d="M72 36v16M96 28v24M120 28v24M144 28v24M168 36v16" opacity=".5"/>',
  },
  sheffield: {
    label: 'Sheffield Steelworks',
    chip:
      HATCH.ground +
      // factory blocks
      '<path d="M8 72V44h18v28M28 72V32h18v40M48 72V48h18v24"/>' +
      // sawtooth / pitched roofs
      '<path d="M8 44l6-8 6 8 6-8"/><path d="M28 32l6-10 6 10 6-10"/><path d="M48 48l5-6 5 6 5-6"/>' +
      // chimneys / stacks
      '<path d="M14 36V16h4v20M36 22V8h4v14M54 42V24h4v18"/>' +
      // smoke wisps (hand-sketch)
      '<path d="M16 14c2-4 0-6-1-8M38 6c2-3 1-5 0-7M56 22c2-3 0-5-1-7" opacity=".4" stroke-width="1"/>' +
      // windows
      HATCH.winRow(11, 52, 2, 6, 4, 6) +
      HATCH.winRow(31, 44, 2, 6, 4, 6) +
      HATCH.winRow(51, 56, 2, 6, 4, 5) +
      // brick / panel lines
      '<path d="M8 58h18M28 52h18M48 60h18" opacity=".3" stroke-width="1"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M28 82V44h48v38M88 82V24h52v58M152 82V52h48v30"/><path d="M28 44l12-14 12 14 12-14"/><path d="M88 24l14-16 14 16 14-16"/><path d="M40 30V8h8v22M108 14V0h8v14M168 40V18h8v22"/><path d="M36 56h12v12H36zM100 44h12v12h-12z" opacity=".5"/>',
  },
  nottingham: {
    label: 'Nottingham Castle',
    chip:
      HATCH.ground +
      // lower rock terrace (distinct from Edinburgh)
      '<path d="M8 72c4-10 12-16 32-16s28 6 32 16" stroke-width="1.5"/>' +
      // ducal palace block
      '<path d="M16 56V34h48v22" stroke-width="1.5"/>' +
      // pediment / gatehouse
      '<path d="M28 34l12-10 12 10" stroke-width="1.4"/>' +
      '<path d="M34 56v-14c0-4 2-6 6-6s6 2 6 6v14" opacity=".55" stroke-width="1.25"/>' +
      // side turrets
      '<path d="M16 34V26h8v8M56 34V26h8v8" stroke-width="1.35"/>' +
      '<path d="M16 26h2v-3h2v3h2v-3h2v3M56 26h2v-3h2v3h2v-3h2v3" stroke-width="1.1"/>' +
      // flag
      '<path d="M40 24V14M40 14h7l-2 2 2 2H40" stroke-width="1.2"/>' +
      '<path d="M20 42h5v6M55 42h5v6" opacity=".5" stroke-width="1"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><path d="M28 82c14-18 36-26 92-26s78 8 92 26"/><path d="M48 62V34h144v28"/><path d="M88 34l32-22 32 22"/><path d="M108 62v-20c0-8 5-12 12-12s12 4 12 12v20" opacity=".55"/><path d="M48 34V20h22v14M170 34V20h22v14"/><path d="M120 12V0M120 0h16l-4 4 4 4h-16"/>',
  },
  cardiff: {
    label: 'Principality Stadium',
    chip:
      HATCH.ground +
      // oval bowl
      '<ellipse cx="40" cy="42" rx="28" ry="16" stroke-width="1.6"/>' +
      '<ellipse cx="40" cy="42" rx="18" ry="9" opacity=".45" stroke-width="1.1"/>' +
      // roof masts / cables
      '<path d="M12 42h56" opacity=".4"/>' +
      '<path d="M16 34l8 8M64 34l-8 8M20 50l6-8M60 50l-6-8" opacity=".4" stroke-width="1"/>' +
      // stands / tiers
      '<path d="M18 52c6 8 14 12 22 12s16-4 22-12" opacity=".5" stroke-width="1.2"/>' +
      // supports
      '<path d="M14 58V42M66 58V42" stroke-width="1.3"/>' +
      '<path d="M14 58h12M54 58h12" opacity=".45"/>' +
      // hatch
      '<path d="M28 38l3 2M36 34l3 2M44 34l3 2M52 38l3 2" opacity=".25" stroke-width=".85"/>',
    hero:
      '<path d="M16 82h208" opacity=".35"/><ellipse cx="120" cy="42" rx="88" ry="28"/><ellipse cx="120" cy="42" rx="52" ry="14" opacity=".45"/><path d="M40 42h160" opacity=".4"/><path d="M48 62c18 14 44 20 72 20s54-6 72-20" opacity=".5"/><path d="M40 62V42M200 62V42"/>',
  },
  brighton: {
    label: 'Royal Pavilion',
    chip:
      HATCH.ground +
      // main onion dome
      '<path d="M24 72V44c4-18 10-26 16-26s12 8 16 26v28" stroke-width="1.5"/>' +
      // dome bulb
      '<path d="M32 28c0-10 3-16 8-16s8 6 8 16" stroke-width="1.4"/>' +
      '<path d="M40 8v6" stroke-width="1.2"/>' +
      // side minarets / domes
      '<path d="M12 72V52c2-8 5-12 8-12s6 4 8 12v20"/>' +
      '<path d="M52 72V52c2-8 5-12 8-12s6 4 8 12v20"/>' +
      '<path d="M16 42c0-5 2-8 4-8s4 3 4 8M56 42c0-5 2-8 4-8s4 3 4 8"/>' +
      // arcade
      '<path d="M28 56c0-3 2-5 4-5s4 2 4 5v8H28V56zM40 56c0-3 2-5 4-5s4 2 4 5v8H40V56z" opacity=".5" stroke-width="1"/>' +
      // decorative band
      '<path d="M24 48h32" opacity=".4"/>' +
      // hatch
      '<path d="M48 36l3 3M48 48l3 3M48 60l3 3" opacity=".25" stroke-width=".85"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M60 82V44c10-32 24-44 60-44s50 12 60 44v38"/><path d="M100 22c0-16 8-24 20-24s20 8 20 24"/><path d="M40 82V56c4-14 10-20 18-20s14 6 18 20v26"/><path d="M164 82V56c4-14 10-20 18-20s14 6 18 20v26"/><path d="M100 58c0-6 4-10 8-10s8 4 8 10v14h-16V58z" opacity=".5"/>',
  },
  cambridge: {
    label: "King's College Chapel",
    chip:
      HATCH.ground +
      // nave
      '<path d="M16 72V28h48v44"/>' +
      // twin turrets
      '<path d="M18 28V14h10v14M52 28V14h10v14"/>' +
      '<path d="M20 14l3-6 3 6M54 14l3-6 3 6"/>' +
      // pinnacles
      '<path d="M23 8v3M57 8v3" stroke-width="1.2"/>' +
      // great windows / fan vault suggestion
      '<path d="M28 36c0-6 4-10 8-10s8 4 8 10v20H28V36z" opacity=".55" stroke-width="1.2"/>' +
      '<path d="M36 36v20M32 42h8M32 50h8" opacity=".4" stroke-width="1"/>' +
      // buttresses
      '<path d="M16 48h4M60 48h4M16 60h4M60 60h4" opacity=".45"/>' +
      // stone courses
      '<path d="M16 44h48M16 56h48" opacity=".28" stroke-width="1"/>' +
      // roof ridge
      '<path d="M16 28h48" stroke-width="1.3"/>',
    hero:
      '<path d="M24 82h192" opacity=".35"/><path d="M48 82V24h144v58"/><path d="M52 24V6h28v18M160 24V6h28v18"/><path d="M60 6l6-8 6 8M168 6l6-8 6 8"/><path d="M96 36c0-12 8-18 16-18s16 6 16 18v28H96V36z" opacity=".55"/><path d="M48 48h144M48 64h144" opacity=".3"/>',
  },
  oxford: {
    label: 'Radcliffe Camera',
    chip:
      HATCH.ground +
      // circular drum
      '<circle cx="40" cy="40" r="22" stroke-width="1.6"/>' +
      // dome
      '<path d="M22 34c4-16 12-24 18-24s14 8 18 24" stroke-width="1.4"/>' +
      '<path d="M40 8v6" stroke-width="1.2"/>' +
      // colonnade / pilasters
      '<path d="M22 40v18M30 36v22M40 34v24M50 36v22M58 40v18" opacity=".45" stroke-width="1.1"/>' +
      // base podium
      '<path d="M20 58h40v14H20z"/>' +
      // windows between columns
      '<path d="M25 44h3v6M35 42h3v6M45 42h3v6M55 44h3v6" opacity=".5" stroke-width="1"/>' +
      // dome ribs
      '<path d="M28 22c4 6 8 10 12 12M52 22c-4 6-8 10-12 12" opacity=".35" stroke-width="1"/>' +
      // steps
      '<path d="M24 66h32M26 70h28" opacity=".4" stroke-width="1"/>',
    hero:
      '<path d="M24 82h192" opacity=".35"/><circle cx="120" cy="42" r="36"/><path d="M90 34c8-28 20-40 30-40s22 12 30 40"/><path d="M120 2v8"/><path d="M88 42v28M100 36v34M120 32v38M140 36v34M152 42v28" opacity=".45"/><path d="M84 70h72v12H84z"/>',
  },
  chester: {
    label: 'Eastgate Clock',
    chip:
      HATCH.ground +
      // arch gateway
      '<path d="M18 72V36h44v36"/>' +
      '<path d="M26 72V48c0-8 4-12 14-12s14 4 14 12v24" opacity=".55" stroke-width="1.3"/>' +
      // clock pavilion
      '<path d="M24 36h32v14H24z"/>' +
      '<circle cx="40" cy="43" r="6" stroke-width="1.3"/>' +
      '<path d="M40 43v-4M40 43l3 2" stroke-width="1.1"/>' +
      // roof / cupola
      '<path d="M28 36l4-8h16l4 8"/>' +
      '<path d="M40 28v-4M36 26h8" stroke-width="1.2"/>' +
      // wrought iron suggestion
      '<path d="M30 52h4M46 52h4M32 58h3M45 58h3" opacity=".4" stroke-width="1"/>' +
      // stone hatch
      '<path d="M20 44l3 3M20 54l3 3M20 64l3 3M57 44l3 3M57 54l3 3M57 64l3 3" opacity=".25" stroke-width=".85"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M60 82V32h120v50"/><path d="M80 82V50c0-14 10-22 40-22s40 8 40 22v32" opacity=".55"/><path d="M72 32h96v28H72z"/><circle cx="120" cy="46" r="12"/><path d="M120 46v-8M120 46l6 4"/><path d="M84 32l10-16h52l10 16"/>',
  },
  'belfast-city-hall': {
    label: 'Belfast City Hall',
    chip:
      HATCH.ground +
      '<path d="M14 72V42h52v30" stroke-width="1.45"/>' +
      '<path d="M14 42l26-12 26 12" stroke-width="1.4"/>' +
      '<path d="M30 42V28h20v14" stroke-width="1.45"/>' +
      '<circle cx="40" cy="34" r="5" stroke-width="1.2"/>' +
      '<path d="M36 28h8l-2-6h-4z" stroke-width="1.2"/>' +
      '<path d="M40 22v3" stroke-width="1.2"/>' +
      '<path d="M20 52h8M52 52h8M20 62h8M52 62h8" opacity=".45" stroke-width="1"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M48 82V44h144v38"/><path d="M48 44l72-18 72 18"/><path d="M96 44V24h48v20"/><circle cx="120" cy="34" r="10"/><path d="M108 24h24l-4-10h-16z"/><path d="M120 14v4"/><path d="M64 56h16M160 56h16" opacity=".45"/>',
  },
  'reading-blade': {
    label: 'The Blade',
    chip:
      HATCH.ground +
      '<path d="M34 72V14h12v58" stroke-width="1.55"/>' +
      '<path d="M30 72h20" stroke-width="1.5"/>' +
      '<path d="M34 24h12M34 36h12M34 48h12M34 60h12" opacity=".4" stroke-width="1"/>' +
      '<path d="M38 14V6h4v8" stroke-width="1.3"/>' +
      '<path d="M46 20l4 3M46 36l4 3M46 52l4 3" opacity=".25" stroke-width=".85"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M104 82V12h32v70"/><path d="M90 82h60" stroke-width="2"/><path d="M104 28h32M104 44h32M104 60h32" opacity=".4"/><path d="M112 12V0h16v12"/><path d="M140 24l8 6M140 44l8 6M140 64l8 6" opacity=".3"/>',
  },
  'leicester-clock-tower': {
    label: 'Leicester Clock Tower',
    chip:
      HATCH.ground +
      '<path d="M28 72V38h24v34" stroke-width="1.5"/>' +
      '<path d="M26 38h28" stroke-width="1.4"/>' +
      '<path d="M32 38V24h16v14" stroke-width="1.4"/>' +
      '<circle cx="40" cy="30" r="5.5" stroke-width="1.2"/>' +
      '<path d="M40 30v-3.5M40 30l2.5 2" stroke-width="1.1"/>' +
      '<path d="M34 18h12l-2-6h-8z" stroke-width="1.2"/>' +
      '<path d="M40 12v3" stroke-width="1.2"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M96 82V34h48v48"/><path d="M92 34h56"/><path d="M104 34V16h32v18"/><circle cx="120" cy="26" r="9"/><path d="M120 26v-5M120 26l4 3"/><path d="M108 16h24l-3-8h-18z"/><path d="M120 8v4"/>',
  },
  'bournemouth-pier': {
    label: 'Bournemouth Pier',
    chip:
      HATCH.ground +
      '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
      '<path d="M10 72V58h12v14M58 72V58h12v14" stroke-width="1.4"/>' +
      '<path d="M22 58h36" stroke-width="1.5"/>' +
      '<path d="M26 58V48h28v10" stroke-width="1.35"/>' +
      '<path d="M24 48l16-8 16 8" stroke-width="1.3"/>' +
      '<path d="M36 40v8M44 40v8" opacity=".45" stroke-width="1"/>' +
      '<path d="M14 62h4M62 62h4" opacity=".4" stroke-width="1"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><path d="M40 82h160" opacity=".35"/><path d="M48 82V56h24v26M168 82V56h24v26"/><path d="M72 56h96" stroke-width="2"/><path d="M80 56V42h80v14"/><path d="M72 42l48-16 48 16"/><path d="M104 30v12M128 30v12" opacity=".45"/>',
  },
  'online-events': {
    label: 'Online events',
    chip:
      HATCH.ground +
      '<rect x="18" y="22" width="44" height="32" rx="2" stroke-width="1.45"/>' +
      '<rect x="22" y="26" width="36" height="24" rx="1" opacity=".45" stroke-width="1"/>' +
      '<circle cx="40" cy="38" r="9" stroke-width="1.25"/>' +
      '<ellipse cx="40" cy="38" rx="9" ry="3.5" opacity=".45" stroke-width="1"/>' +
      '<path d="M31 38h18M40 29v18" opacity=".45" stroke-width="1"/>' +
      '<path d="M33 32c3 2 6 3 7 3s4-1 7-3M33 44c3-2 6-3 7-3s4 1 7 3" opacity=".4" stroke-width="1"/>' +
      '<path d="M30 58h20" stroke-width="1.35"/>' +
      '<path d="M40 54v4M36 58h8" stroke-width="1.25"/>' +
      '<path d="M52 30c4 2 7 5 9 9M52 46c4-2 7-5 9-9" opacity=".45" stroke-width="1.1"/>' +
      '<path d="M56 34c2 1 3 3 3 4M56 42c2-1 3-3 3-4" opacity=".45" stroke-width="1.1"/>',
    hero:
      '<path d="M20 82h200" opacity=".35"/><rect x="56" y="16" width="128" height="56" rx="3" stroke-width="2"/><rect x="64" y="24" width="112" height="40" rx="2" opacity=".45"/><circle cx="120" cy="44" r="16" stroke-width="1.8"/><ellipse cx="120" cy="44" rx="16" ry="6" opacity=".45"/><path d="M96 44h48M120 28v32" opacity=".45"/><path d="M88 82h64" stroke-width="2"/><path d="M120 74v8M108 82h24"/>',
  },
};

/** @type {Record<string, string>} */
const LANDMARK_BY_REGION = {
  'central-london': 'big-ben',
  'north-london': 'alexandra-palace',
  'south-london': 'o2-arena',
  'east-london': 'tower-bridge',
  'west-london': 'battersea',
  manchester: 'manchester',
  birmingham: 'birmingham',
  glasgow: 'glasgow',
  edinburgh: 'edinburgh',
  leeds: 'leeds',
  bristol: 'bristol',
  chester: 'chester',
  liverpool: 'liverpool',
  newcastle: 'newcastle',
  sheffield: 'sheffield',
  nottingham: 'nottingham',
  cardiff: 'cardiff',
  brighton: 'brighton',
  cambridge: 'cambridge',
  oxford: 'oxford',
  belfast: 'belfast-city-hall',
  reading: 'reading-blade',
  leicester: 'leicester-clock-tower',
  bournemouth: 'bournemouth-pier',
  online: 'online-events',
};

function landmarkKeyForRegion(slug) {
  return LANDMARK_BY_REGION[String(slug || '').trim().toLowerCase()] || null;
}

function landmarkChip(key) {
  const item = LANDMARKS[key];
  return item ? chipSvg(item.chip) : '';
}

function landmarkHero(key) {
  const item = LANDMARKS[key];
  return item ? heroSvg(item.hero) : '';
}

function landmarkForRegion(slug) {
  const key = landmarkKeyForRegion(slug);
  if (!key) return { key: null, chip: '', hero: '', label: '' };
  const item = LANDMARKS[key];
  return {
    key,
    chip: landmarkChip(key),
    hero: landmarkHero(key),
    label: item ? item.label : '',
  };
}

module.exports = {
  LANDMARKS,
  LANDMARK_BY_REGION,
  landmarkKeyForRegion,
  landmarkChip,
  landmarkHero,
  landmarkForRegion,
};
