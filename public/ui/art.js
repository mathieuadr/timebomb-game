// Illustrations originales de Coupe-Circuit, dessinées en SVG (aucune image externe).
// Tout ce module renvoie des chaînes statiques : aucune donnée saisie par un joueur n'y entre.

// ───────────────────────────────────────────── Dégradés partagés (installés une fois dans la page)

const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="gIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff0ff"/><stop offset="1" stop-color="#4fc3ff"/></linearGradient>
  <linearGradient id="gAurora" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5dffc0"/><stop offset="1" stop-color="#7fdcff"/></linearGradient>
  <linearGradient id="gEmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ff4d3d"/></linearGradient>
  <linearGradient id="gViolet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3ccff"/><stop offset="1" stop-color="#9a62ff"/></linearGradient>
  <linearGradient id="gBack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12284d"/><stop offset="1" stop-color="#081327"/></linearGradient>
  <linearGradient id="gInert" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4762"/><stop offset="1" stop-color="#1c2538"/></linearGradient>
  <linearGradient id="gBypass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f5f5a"/><stop offset="1" stop-color="#08283a"/></linearGradient>
  <linearGradient id="gOverload" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a1d12"/><stop offset="1" stop-color="#2a0909"/></linearGradient>
  <linearGradient id="gSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b2b48"/><stop offset=".5" stop-color="#3a5078"/><stop offset="1" stop-color="#16233c"/></linearGradient>
  <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030816"/><stop offset=".65" stop-color="#0b1d3d"/><stop offset="1" stop-color="#1a3a63"/></linearGradient>
  <linearGradient id="gSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dff3ff"/><stop offset="1" stop-color="#8fb4d8"/></linearGradient>
  <linearGradient id="gRibbonA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5dffc0" stop-opacity="0"/><stop offset=".35" stop-color="#5dffc0" stop-opacity=".85"/><stop offset=".7" stop-color="#7fdcff" stop-opacity=".7"/><stop offset="1" stop-color="#9a62ff" stop-opacity="0"/></linearGradient>
  <linearGradient id="gRibbonB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fdcff" stop-opacity="0"/><stop offset=".5" stop-color="#8affd9" stop-opacity=".7"/><stop offset="1" stop-color="#5dffc0" stop-opacity="0"/></linearGradient>
  <radialGradient id="gGlowIce"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#7fdcff" stop-opacity=".9"/><stop offset="1" stop-color="#7fdcff" stop-opacity="0"/></radialGradient>
  <radialGradient id="gGlowEmber"><stop offset="0" stop-color="#fff3d0"/><stop offset=".35" stop-color="#ff8a3d" stop-opacity=".9"/><stop offset="1" stop-color="#ff4d3d" stop-opacity="0"/></radialGradient>
  <radialGradient id="gGlowViolet"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#b07bff" stop-opacity=".9"/><stop offset="1" stop-color="#b07bff" stop-opacity="0"/></radialGradient>
  <filter id="fSoft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
</defs></svg>`;

export function installDefs() {
  if (document.getElementById('art-defs')) return;
  const holder = document.createElement('div');
  holder.id = 'art-defs';
  holder.innerHTML = DEFS;
  document.body.prepend(holder);
}

// ───────────────────────────────────────────── Icônes (trait, 24 × 24)

const icon = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const ICON = {
  pince: icon('<path d="M7.5 2.5 12 10l4.5-7.5"/><path d="M12 10v2.5"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/><path d="M12 13 7 21.5"/><path d="M12 13l5 8.5"/><path d="M6.2 19.2l2.3 1.4M17.8 19.2l-2.3 1.4" stroke-width="3.2"/>'),
  soundOn: icon('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.6 7.6 0 0 1 0 11"/>'),
  soundOff: icon('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="m16 9.5 5 5m0-5-5 5"/>'),
  motionOn: icon('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="2.5"/>'),
  motionOff: icon('<circle cx="12" cy="12" r="2.5"/><path d="M4 12h3M17 12h3"/>'),
  menu: icon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
  back: icon('<path d="M15 5l-7 7 7 7"/>'),
  up: icon('<path d="m6 14 6-6 6 6"/>'),
  down: icon('<path d="m6 10 6 6 6-6"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/>'),
  dice: icon('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  eye: icon('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff: icon('<path d="M4 4l16 16"/><path d="M9.5 6A9.6 9.6 0 0 1 12 5.5c6 0 9.500 6.500 9.500 6.500a15 15 0 0 1-2.800 3.400M6.200 7.700A15 15 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 3.300-.6"/>'),
  history: icon('<path d="M4 12a8 8 0 1 0 2.600-5.900"/><path d="M4 4v4h4"/><path d="M12 8v4.500l3 1.800"/>'),
  check: icon('<path d="m5 12.500 4.500 4.500L19 7.500"/>'),
  phone: icon('<rect x="7" y="2.500" width="10" height="19" rx="2.500"/><path d="M11 18.500h2"/>'),
  book: icon('<path d="M5 4.500h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.500a3 3 0 0 1 3-3h11"/>'),
  bolt: icon('<path d="M13.500 2.500 5 13.500h6l-1 8 8.500-11h-6z"/>'),
  users: icon('<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500c0-3.300 2.700-5.500 6-5.500s6 2.200 6 5.500"/><path d="M16 5.500a3.200 3.200 0 0 1 0 6.200M17.500 14.300c2.100.6 3.500 2.400 3.500 5.200"/>'),
  flag: icon('<path d="M6 21V4"/><path d="M6 4.500h11l-2.500 4 2.500 4H6"/>'),
  home: icon('<path d="M4 11.500 12 4.500l8 7"/><path d="M6.500 10v9.500h11V10"/>'),
  replay: icon('<path d="M20 12a8 8 0 1 1-2.600-5.900"/><path d="M20 4v4h-4"/>'),
};

// ───────────────────────────────────────────── Cartes Câble (100 × 140)

const CARD = (inner) => `<svg viewBox="0 0 100 140" class="cardsvg" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;

export const wireBack = () => CARD(`
  <rect x="1.500" y="1.500" width="97" height="137" rx="10" fill="url(#gBack)" stroke="#7fdcff" stroke-opacity=".5" stroke-width="1.500"/>
  <rect x="7" y="7" width="86" height="126" rx="6.500" fill="none" stroke="#7fdcff" stroke-opacity=".16"/>
  <g stroke="#7fdcff" stroke-opacity=".3" stroke-width="1.500" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 24h17l9 9v14"/><path d="M85 31H69l-8 8v8"/><path d="M15 116h19l8-8V94"/><path d="M85 109H68l-8-8v-7"/><path d="M50 13v20M50 107v20"/>
  </g>
  <g fill="#7fdcff" fill-opacity=".55"><circle cx="15" cy="24" r="2.400"/><circle cx="85" cy="31" r="2.400"/><circle cx="15" cy="116" r="2.400"/><circle cx="85" cy="109" r="2.400"/><circle cx="50" cy="13" r="2.400"/><circle cx="50" cy="127" r="2.400"/></g>
  <circle cx="50" cy="70" r="23" fill="#061021" stroke="url(#gIce)" stroke-width="2.500"/>
  <circle cx="50" cy="70" r="17.500" fill="none" stroke="#7fdcff" stroke-opacity=".25" stroke-dasharray="3 4"/>
  <path d="M54.500 53 41.500 72.500h8.500l-4.500 14.500 13.500-20h-8.500z" fill="url(#gIce)"/>`);

const FACES = {
  inert: `
  <rect x="1.500" y="1.500" width="97" height="137" rx="10" fill="url(#gInert)" stroke="#a9b8d4" stroke-opacity=".8" stroke-width="1.500"/>
  <rect x="7" y="7" width="86" height="126" rx="6.500" fill="none" stroke="#a9b8d4" stroke-opacity=".2"/>
  <path d="M28 22v14c0 12 44 10 44 26s-44 12-44 28v6" fill="none" stroke="#0e1524" stroke-width="11" stroke-linecap="round"/>
  <path d="M28 22v14c0 12 44 10 44 26s-44 12-44 28v6" fill="none" stroke="#8d9bb6" stroke-width="7" stroke-linecap="round"/>
  <path d="M28 22v14c0 12 44 10 44 26s-44 12-44 28v6" fill="none" stroke="#c9d4e8" stroke-width="1.600" stroke-linecap="round" stroke-opacity=".7" transform="translate(-1.500 0)"/>
  <rect x="21" y="12" width="14" height="13" rx="3" fill="#c9d4e8"/><rect x="21" y="93" width="14" height="13" rx="3" fill="#c9d4e8"/>
  <text x="50" y="126" text-anchor="middle" font-size="11.500" font-weight="800" letter-spacing="1.500" fill="#c9d4e8">INERTE</text>`,
  bypass: `
  <rect x="1.500" y="1.500" width="97" height="137" rx="10" fill="url(#gBypass)" stroke="#5dffc0" stroke-width="1.800"/>
  <rect x="7" y="7" width="86" height="126" rx="6.500" fill="none" stroke="#5dffc0" stroke-opacity=".25"/>
  <circle cx="50" cy="60" r="34" fill="url(#gGlowIce)" opacity=".35"/>
  <path d="M50 14v22M50 36C50 52 26 50 26 68v32M50 36c0 16 24 14 24 32v32" fill="none" stroke="#04202a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 14v22M50 36C50 52 26 50 26 68v32M50 36c0 16 24 14 24 32v32" fill="none" stroke="url(#gAurora)" stroke-width="6.500" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="36" r="9" fill="#04202a" stroke="#eafff8" stroke-width="2.500"/><circle cx="50" cy="36" r="3.600" fill="#eafff8"/>
  <text x="50" y="126" text-anchor="middle" font-size="10" font-weight="800" letter-spacing=".8" fill="#bfffe9">DÉRIVATION</text>`,
  overload: `
  <rect x="1.500" y="1.500" width="97" height="137" rx="10" fill="url(#gOverload)" stroke="#ff8a3d" stroke-width="1.800"/>
  <rect x="7" y="7" width="86" height="126" rx="6.500" fill="none" stroke="#ff8a3d" stroke-opacity=".3"/>
  <circle cx="50" cy="60" r="40" fill="url(#gGlowEmber)" opacity=".55"/>
  <g stroke="#ffd27a" stroke-width="2.600" stroke-linecap="round"><path d="M50 12v9"/><path d="M17 27l6 6"/><path d="M83 27l-6 6"/><path d="M10 62h9"/><path d="M90 62h-9"/><path d="M19 96l6-6"/><path d="M81 96l-6-6"/></g>
  <path d="M58 20 30 64h17l-8 40 32-50H54z" fill="#2a0909" stroke="#2a0909" stroke-width="6" stroke-linejoin="round"/>
  <path d="M58 20 30 64h17l-8 40 32-50H54z" fill="url(#gEmber)" stroke="#fff3d0" stroke-width="1.600" stroke-linejoin="round"/>
  <text x="50" y="126" text-anchor="middle" font-size="10.500" font-weight="900" letter-spacing=".8" fill="#ffd9b0">SURCHARGE</text>`,
};

export const wireFace = (kind) => CARD(FACES[kind]);

// ───────────────────────────────────────────── Portraits des cartes Rôle (200 × 200)

const SKIN = ['#f3c9a5', '#d9a273', '#a86e45', '#7a4a2b', '#f0b99a', '#c68a5d', '#e8b48a', '#8d5a3a'];
const HAIR = ['#2a1b12', '#5a3a1e', '#c9a25a', '#1a1a22', '#8a3b1e', '#e6e1d6', '#3b2a4a', '#111111'];

function head({ skin, hair, style = 0, eyewear = 0, mouth = 0, lens = '#7fdcff' }) {
  const hairs = [
    `<path d="M68 86c-2-26 12-40 32-40s34 14 32 40c-6-14-16-22-32-22s-26 8-32 22z" fill="${hair}"/>`,
    `<path d="M66 92c-4-30 12-48 34-48s38 18 34 48c-4-20-14-30-34-30S70 72 66 92z" fill="${hair}"/><path d="M66 90c-3 14-2 26 2 36M134 90c3 14 2 26-2 36" stroke="${hair}" stroke-width="9" stroke-linecap="round" fill="none"/>`,
    `<path d="M66 82c0-22 14-36 34-36s34 14 34 36l-4 2c-8-10-18-14-30-14s-22 4-30 14z" fill="${hair}"/><rect x="64" y="76" width="72" height="10" rx="5" fill="${hair}" opacity=".85"/>`,
    `<path d="M70 84c0-22 12-34 30-34s30 12 30 34c-10-12-20-16-30-16s-20 4-30 16z" fill="${hair}"/><path d="M96 50c2-8 10-10 12-4" stroke="${hair}" stroke-width="6" stroke-linecap="round" fill="none"/>`,
  ];
  const eyes = `<ellipse cx="87" cy="98" rx="3.600" ry="4.400" fill="#1a1420"/><ellipse cx="113" cy="98" rx="3.600" ry="4.400" fill="#1a1420"/><circle cx="88.200" cy="96.600" r="1.100" fill="#fff"/><circle cx="114.200" cy="96.600" r="1.100" fill="#fff"/>`;
  const wear = [
    eyes,
    `${eyes}<g fill="none" stroke="#1a1420" stroke-width="2.600"><circle cx="87" cy="98" r="9.500"/><circle cx="113" cy="98" r="9.500"/><path d="M96.500 98h7"/></g>`,
    `<rect x="68" y="86" width="64" height="24" rx="12" fill="#101828" stroke="#dfe9f7" stroke-width="2.600"/><rect x="73" y="90.500" width="24" height="15" rx="7.500" fill="${lens}"/><rect x="103" y="90.500" width="24" height="15" rx="7.500" fill="${lens}"/><path d="M77 95h9M107 95h9" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M70 92q30-10 60 0l-2 16q-28 8-56 0z" fill="#101828" stroke="#dfe9f7" stroke-width="2.400"/><path d="M75 95q25-7 50 0l-1.500 10q-23.500 6-47 0z" fill="${lens}"/><path d="M80 98h14" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,
  ];
  const mouths = [
    `<path d="M91 116q9 7 18 0" stroke="#7a2f2a" stroke-width="2.800" fill="none" stroke-linecap="round"/>`,
    `<path d="M92 118h16" stroke="#7a2f2a" stroke-width="2.800" stroke-linecap="round"/>`,
    `<path d="M92 118q8 3 17-4" stroke="#7a2f2a" stroke-width="2.800" fill="none" stroke-linecap="round"/>`,
  ];
  return `<ellipse cx="100" cy="96" rx="33" ry="37" fill="${skin}"/><ellipse cx="80" cy="110" rx="6" ry="4" fill="#ff7a6a" opacity=".22"/><ellipse cx="120" cy="110" rx="6" ry="4" fill="#ff7a6a" opacity=".22"/>${hairs[style % hairs.length]}${wear[eyewear % wear.length]}${mouths[mouth % mouths.length]}`;
}

function portrait({ bg, ring, parka, parkaDark, trim, lining, accent, extra = '', ...face }) {
  return `<svg viewBox="0 0 200 200" class="portrait" preserveAspectRatio="xMidYMid slice">
  <rect width="200" height="200" fill="${bg}"/>
  <path d="M-10 70q60-50 110-18t120-30v40q-70 44-120 14T-10 120z" fill="${ring}" opacity=".28"/>
  <path d="M-10 30q70-34 120-10t100-20v26q-60 30-110 8T-10 66z" fill="${ring}" opacity=".16"/>
  <g fill="#fff" opacity=".7"><circle cx="24" cy="26" r="1.300"/><circle cx="172" cy="40" r="1.600"/><circle cx="150" cy="16" r="1"/><circle cx="40" cy="62" r="1"/><circle cx="184" cy="88" r="1.200"/></g>
  <path d="M14 204c0-40 22-58 56-62h60c34 4 56 22 56 62z" fill="${parka}"/>
  <path d="M100 150v54" stroke="${parkaDark}" stroke-width="4"/>
  <path d="M40 160c14-8 26-12 30-18M160 160c-14-8-26-12-30-18" stroke="${parkaDark}" stroke-width="3" fill="none" opacity=".7"/>
  <ellipse cx="100" cy="92" rx="60" ry="64" fill="${trim}"/>
  <ellipse cx="100" cy="94" rx="50" ry="55" fill="${lining}"/>
  ${head(face)}
  <path d="M56 138c14 14 30 20 44 20s30-6 44-20l8 14c-16 14-34 20-52 20s-36-6-52-20z" fill="${trim}"/>
  <rect x="118" y="168" width="26" height="16" rx="3" fill="${accent}" stroke="#061021" stroke-width="1.500"/>
  <path d="M123 176h16" stroke="#061021" stroke-width="2" stroke-linecap="round" opacity=".6"/>
  ${extra}</svg>`;
}

const HEADSET = `<path d="M62 96c0-26 16-44 38-44s38 18 38 44" fill="none" stroke="#101828" stroke-width="5"/><rect x="54" y="90" width="13" height="22" rx="6" fill="#101828"/><path d="M60 112c2 12 14 16 26 14" stroke="#101828" stroke-width="3.500" fill="none" stroke-linecap="round"/>`;
const SCARF = (c) => `<path d="M64 120q36 22 72 0l4 22q-40 22-80 0z" fill="${c}"/><path d="M70 132q30 14 60 0" stroke="#061021" stroke-opacity=".25" stroke-width="3" fill="none"/>`;

function techPortrait(i) {
  const parkas = [['#2f8fd6', '#1d5f96'], ['#27b3a6', '#16756d'], ['#3b6fe0', '#2648a0'], ['#4aa8e8', '#2b6fa3'], ['#2a9ac2', '#1a6480'], ['#5b8def', '#3558b0'], ['#1fa3c4', '#126a82'], ['#3d7bd9', '#254e96']];
  const [parka, parkaDark] = parkas[i % 8];
  return portrait({
    bg: '#0a2244', ring: '#5dffc0', parka, parkaDark, trim: '#eef6ff', lining: '#0e2a4d', accent: '#4fc3ff',
    skin: SKIN[i % 8], hair: HAIR[(i * 3) % 8], style: i % 4, eyewear: [0, 2, 1, 0, 3, 0, 1, 2][i % 8], mouth: 0, lens: '#7fdcff',
    extra: i % 3 === 1 ? HEADSET : '',
  });
}

function sabPortrait(i) {
  const parkas = [['#3b3440', '#231e28'], ['#4a2f2a', '#2b1a17'], ['#33383f', '#1d2126'], ['#51342a', '#2f1d17'], ['#3a2f3c', '#211a22'], ['#45393a', '#281f20'], ['#2f3340', '#1a1d26'], ['#4d2c2c', '#2c1818']];
  const [parka, parkaDark] = parkas[i % 8];
  return portrait({
    bg: '#2a0f12', ring: '#ff8a3d', parka, parkaDark, trim: '#e9d6c4', lining: '#1c0c0e', accent: '#ff8a3d',
    skin: SKIN[(i + 3) % 8], hair: HAIR[(i * 5 + 1) % 8], style: (i + 2) % 4, eyewear: [3, 0, 2, 1, 0, 3, 2, 0][i % 8], mouth: 2, lens: '#ff8a3d',
    extra: i % 3 === 0 ? SCARF('#ff8a3d') : '',
  });
}

export function rolePortrait(role, char = 0) {
  if (role === 'tech') return techPortrait(char);
  if (role === 'sab') return sabPortrait(char);
  if (role === 'mole') {
    return portrait({ bg: '#2a0f12', ring: '#ff8a3d', parka: '#2f8fd6', parkaDark: '#1d5f96', trim: '#eef6ff', lining: '#3a1410', accent: '#4fc3ff', skin: SKIN[1], hair: HAIR[3], style: 3, eyewear: 3, mouth: 2, lens: '#ff8a3d' });
  }
  if (role === 'infiltrator') {
    return portrait({ bg: '#0a2244', ring: '#5dffc0', parka: '#4a2f2a', parkaDark: '#2b1a17', trim: '#e9d6c4', lining: '#0e2a4d', accent: '#ff8a3d', skin: SKIN[4], hair: HAIR[1], style: 1, eyewear: 2, mouth: 0, lens: '#7fdcff', extra: SCARF('#4fc3ff') });
  }
  // Électron libre : visière intégrale traversée par un éclair
  return `<svg viewBox="0 0 200 200" class="portrait" preserveAspectRatio="xMidYMid slice">
  <rect width="200" height="200" fill="#1a0f33"/>
  <path d="M-10 70q60-50 110-18t120-30v40q-70 44-120 14T-10 120z" fill="#b07bff" opacity=".3"/>
  <path d="M-10 30q70-34 120-10t100-20v26q-60 30-110 8T-10 66z" fill="#7fdcff" opacity=".14"/>
  <g fill="#fff" opacity=".7"><circle cx="24" cy="26" r="1.300"/><circle cx="172" cy="40" r="1.600"/><circle cx="150" cy="16" r="1"/><circle cx="184" cy="88" r="1.200"/></g>
  <path d="M14 204c0-40 22-58 56-62h60c34 4 56 22 56 62z" fill="#5b3aa8"/>
  <path d="M100 150v54" stroke="#35206b" stroke-width="4"/>
  <ellipse cx="100" cy="92" rx="60" ry="64" fill="#e9dcff"/>
  <ellipse cx="100" cy="94" rx="50" ry="55" fill="#1a0f33"/>
  <ellipse cx="100" cy="96" rx="36" ry="40" fill="#0b0618" stroke="url(#gViolet)" stroke-width="3"/>
  <path d="M72 80q28-16 56 0" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M108 66 86 98h13l-7 28 24-36h-13z" fill="url(#gViolet)" stroke="#fff" stroke-width="1.200" stroke-linejoin="round"/>
  <path d="M56 138c14 14 30 20 44 20s30-6 44-20l8 14c-16 14-34 20-52 20s-36-6-52-20z" fill="#e9dcff"/>
  </svg>`;
}

/** Badge (couverture) : une carte d'accès à la couleur d'une équipe. */
export const badgeArt = (color) => {
  const c = color === 'orange' ? ['#ff8a3d', '#ffd27a', '#3a1410'] : ['#4fc3ff', '#bff0ff', '#0a2244'];
  return `<svg viewBox="0 0 40 52" class="badge-svg"><path d="M14 2h12v8H14z" fill="${c[1]}" opacity=".8"/><rect x="3" y="8" width="34" height="42" rx="6" fill="${c[2]}" stroke="${c[0]}" stroke-width="2.500"/><circle cx="20" cy="23" r="6.500" fill="${c[0]}"/><path d="M9 43c1-7 5-10 11-10s10 3 11 10z" fill="${c[0]}"/><rect x="15" y="4" width="10" height="4" rx="2" fill="#061021"/></svg>`;
};

// ───────────────────────────────────────────── Réacteur (centre de la table)

/**
 * @param {number} found  dérivations trouvées
 * @param {number} total  dérivations à trouver
 * @param {'idle'|'safe'|'boom'|'solo'} mood
 */
export function reactorArt(found, total, mood = 'idle') {
  const top = 78;
  const bottom = 236;
  const gap = 5;
  const bandH = (bottom - top - gap * (total - 1)) / total;
  let bands = '';
  for (let i = 0; i < total; i++) {
    const y = bottom - (i + 1) * bandH - i * gap;
    const lit = i < found;
    bands += lit
      ? `<rect x="38" y="${(y - 3).toFixed(1)}" width="44" height="${(bandH + 6).toFixed(1)}" rx="8" fill="#5dffc0" opacity=".22"/><rect class="band lit" x="43" y="${y.toFixed(1)}" width="34" height="${bandH.toFixed(1)}" rx="5" fill="url(#gAurora)"/>`
      : `<rect class="band" x="43" y="${y.toFixed(1)}" width="34" height="${bandH.toFixed(1)}" rx="5" fill="#0c1a33" stroke="#2c4a78" stroke-width="1.200"/>`;
  }
  const glow = { idle: 'gGlowEmber', safe: 'gGlowIce', boom: 'gGlowEmber', solo: 'gGlowViolet' }[mood];
  const beacon = { idle: '#ff8a3d', safe: '#5dffc0', boom: '#ff4d3d', solo: '#b07bff' }[mood];
  return `<svg viewBox="0 0 120 290" class="reactor ${mood}" preserveAspectRatio="xMidYMid meet">
  <ellipse cx="60" cy="272" rx="56" ry="12" fill="#0a1830"/>
  <path d="M6 274q54-20 108 0v16H6z" fill="url(#gSnow)" opacity=".9"/>
  <path d="M22 262h76l-8-22H30z" fill="#22355a" stroke="#3d5a8c" stroke-width="1.500"/>
  <path d="M2 262c10-2 16-10 26-10" stroke="#4fc3ff" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M118 262c-10-2-16-10-26-10" stroke="#ff8a3d" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="34" y="64" width="52" height="180" rx="12" fill="url(#gSteel)" stroke="#4a6699" stroke-width="1.500"/>
  <rect x="28" y="96" width="6" height="120" rx="3" fill="#22355a"/><rect x="86" y="96" width="6" height="120" rx="3" fill="#22355a"/>
  ${bands}
  <path d="M34 66c0-18 12-28 26-28s26 10 26 28z" fill="#2c4470" stroke="#4a6699" stroke-width="1.500"/>
  <path d="M60 38V14" stroke="#8fa8d0" stroke-width="3" stroke-linecap="round"/>
  <circle class="beacon-glow" cx="60" cy="13" r="12" fill="url(#${glow})"/>
  <circle class="beacon" cx="60" cy="13" r="4.500" fill="${beacon}"/>
  <circle cx="60" cy="54" r="7" fill="#061021" stroke="${beacon}" stroke-width="2"/>
  <path d="M61.500 49.500 57 55h3l-1.500 4.500L63 53.500h-3z" fill="${beacon}"/>
  </svg>`;
}

// ───────────────────────────────────────────── Scène d'accueil et de fin de partie

/** @param {'home'|'safe'|'boom'|'solo'} mood */
export function sceneArt(mood = 'home') {
  const ribbons = mood === 'boom' ? '' : `
  <g class="ribbons" filter="url(#fSoft)">
    <path class="rb rb1" d="M-40 96C40 20 120 130 200 70s150-30 240-60v56C350 96 280 70 200 128S40 80-40 150z" fill="url(#${mood === 'solo' ? 'gViolet' : 'gRibbonA'})" opacity="${mood === 'solo' ? '.5' : '1'}"/>
    <path class="rb rb2" d="M-40 150C60 90 130 180 220 130s120-40 220-30v40C340 130 300 150 220 180S50 130-40 190z" fill="url(#gRibbonB)"/>
  </g>`;
  const sky = mood === 'boom' ? '<rect width="400" height="420" fill="#1a0606"/><circle cx="200" cy="250" r="230" fill="url(#gGlowEmber)" opacity=".75"/>' : '<rect width="400" height="420" fill="url(#gSky)"/>';
  const stars = [[30, 40, 1.4], [70, 110, 1], [120, 30, 1.2], [160, 80, 0.9], [230, 26, 1.5], [280, 90, 1], [330, 44, 1.3], [372, 120, 1], [52, 180, 0.9], [350, 190, 1.1], [200, 150, 0.8], [110, 150, 1]]
    .map(([x, y, r], i) => `<circle class="star s${i % 3}" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('');
  const beacon = { home: '#ff8a3d', safe: '#5dffc0', boom: '#ff4d3d', solo: '#b07bff' }[mood];
  const glow = { home: 'gGlowEmber', safe: 'gGlowIce', boom: 'gGlowEmber', solo: 'gGlowViolet' }[mood];
  const bandFill = mood === 'safe' ? 'url(#gAurora)' : mood === 'solo' ? 'url(#gViolet)' : mood === 'boom' ? 'url(#gEmber)' : null;
  let bands = '';
  for (let i = 0; i < 5; i++) {
    const y = 300 - i * 24;
    const lit = bandFill && (mood !== 'home');
    const homeLit = mood === 'home' && i < 2;
    bands += `<rect x="186" y="${y}" width="28" height="17" rx="4" fill="${lit ? bandFill : homeLit ? 'url(#gAurora)' : '#0c1a33'}" stroke="#2c4a78" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 400 420" class="scene ${mood}" preserveAspectRatio="xMidYMax slice">
  ${sky}
  <g class="stars">${mood === 'boom' ? '' : stars}</g>
  ${ribbons}
  <path d="M0 330l50-58 34 30 46-70 52 66 40-34 54 60 44-50 80 70v76H0z" fill="${mood === 'boom' ? '#3a0f0c' : '#122a4e'}"/>
  <path d="M130 232l-14 22 12-4 6 12 10-14 8 4zM50 272l-10 14 10-3 6 8 6-10zM320 274l-12 16 12-4 6 9 8-11z" fill="${mood === 'boom' ? '#7a2a1a' : '#cfe6fb'}" opacity=".85"/>
  <path d="M0 356q100-30 200-12t200-14v90H0z" fill="url(#gSnow)" opacity="${mood === 'boom' ? '.35' : '1'}"/>
  <g class="station">
    <path d="M60 366a44 44 0 0 1 88 0z" fill="#1c3156" stroke="#5d7fb5" stroke-width="2"/>
    <path d="M78 366a26 26 0 0 1 52 0" fill="none" stroke="#5d7fb5" stroke-width="1.500" opacity=".7"/>
    <rect x="92" y="344" width="10" height="9" rx="2" fill="#ffd27a"/><rect x="108" y="344" width="10" height="9" rx="2" fill="#ffd27a" opacity=".8"/>
    <path d="M252 366a40 40 0 0 1 80 0z" fill="#1c3156" stroke="#5d7fb5" stroke-width="2"/>
    <rect x="278" y="346" width="10" height="9" rx="2" fill="#7fdcff"/><rect x="294" y="346" width="10" height="9" rx="2" fill="#ffd27a"/>
    <path d="M336 366v-62" stroke="#8fa8d0" stroke-width="3" stroke-linecap="round"/><path d="M324 318l12-14 12 14M328 332l8-10 8 10" stroke="#8fa8d0" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="336" cy="302" r="3" fill="#ff4d3d" class="blink"/>
    <path d="M148 362q22-12 30 2M252 362q-22-12-30 2" stroke="#22355a" stroke-width="5" fill="none"/>
  </g>
  <g class="tower">
    <path d="M160 372h80l-10-26h-60z" fill="#22355a" stroke="#3d5a8c" stroke-width="1.500"/>
    <rect x="178" y="186" width="44" height="164" rx="11" fill="url(#gSteel)" stroke="#4a6699" stroke-width="1.500"/>
    ${bands}
    <path d="M178 190c0-18 10-26 22-26s22 8 22 26z" fill="#2c4470" stroke="#4a6699" stroke-width="1.500"/>
    <path d="M200 164v-26" stroke="#8fa8d0" stroke-width="3" stroke-linecap="round"/>
    <circle class="beacon-glow" cx="200" cy="136" r="${mood === 'home' ? 26 : 46}" fill="url(#${glow})"/>
    <circle class="beacon" cx="200" cy="136" r="5" fill="${beacon}"/>
  </g>
  <path d="M40 392c40-14 70 10 110-2s40-18 50-18" stroke="#4fc3ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
  <path d="M360 396c-40-12-64 8-104-4s-46-20-56-20" stroke="#ff8a3d" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
  </svg>`;
}

/** Icône de l'application (aussi utilisée pour générer les PNG). */
export const appIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1d3d"/><stop offset="1" stop-color="#040a18"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff0ff"/><stop offset="1" stop-color="#4fc3ff"/></linearGradient>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5dffc0"/><stop offset="1" stop-color="#7fdcff"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#a)"/>
  <path d="M-20 190C90 90 200 250 310 170s150-60 240-70v70C440 200 400 190 310 250S90 170-20 260z" fill="url(#c)" opacity=".28"/>
  <circle cx="256" cy="262" r="150" fill="#061021" stroke="url(#b)" stroke-width="16"/>
  <path d="M60 262h92M360 262h92" stroke="#4fc3ff" stroke-width="22" stroke-linecap="round"/>
  <path d="M360 262h92" stroke="#ff8a3d" stroke-width="22" stroke-linecap="round"/>
  <path d="M286 142 196 276h58l-30 96 94-136h-58z" fill="url(#b)"/>
</svg>`;
