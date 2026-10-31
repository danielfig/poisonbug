(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  }
  if (typeof root !== 'undefined') {
    root.POISONBUG_STARTER_CARDS = data;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function svgCardDataUri({ bg1, bg2, accent, title, hp, type, iconSvg, footer }) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bg1}"/>
          <stop offset="100%" stop-color="${bg2}"/>
        </linearGradient>
        <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}"/>
          <stop offset="50%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
        <radialGradient id="artGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#090514" stop-opacity="0.95"/>
        </radialGradient>
      </defs>
      <rect x="6" y="6" width="348" height="468" rx="22" fill="url(#bg)" stroke="url(#frame)" stroke-width="10"/>
      <rect x="22" y="22" width="316" height="436" rx="14" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/>
      <!-- Header -->
      <text x="34" y="54" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="20">${title}</text>
      <text x="326" y="54" text-anchor="end" fill="${accent}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="18">${hp}</text>
      <!-- Art Window -->
      <rect x="30" y="68" width="300" height="230" rx="12" fill="url(#artGlow)" stroke="${accent}" stroke-width="3"/>
      <g transform="translate(180, 183)">
        ${iconSvg}
      </g>
      <!-- Type Banner -->
      <rect x="30" y="312" width="300" height="28" rx="8" fill="#090514" fill-opacity="0.65" stroke="${accent}" stroke-opacity="0.4"/>
      <text x="180" y="331" text-anchor="middle" fill="${accent}" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="13" letter-spacing="1">${type}</text>
      <!-- Attack Box -->
      <text x="36" y="372" fill="#f3e8ff" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="15">${footer}</text>
      <line x1="34" y1="392" x2="326" y2="392" stroke="#ffffff" stroke-opacity="0.18"/>
      <text x="180" y="432" text-anchor="middle" fill="#e9d5ff" fill-opacity="0.8" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="12">POISONBUG SERIES • FIRST EDITION</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  return [
    {
      id: 'starter-venom-beetle',
      name: 'Shadow Venom Beetle GX',
      price: 14.99,
      rarity: 'Ultra Rare',
      description: 'First-edition holographic purple poison beetle card in mint sleeve condition.',
      imageData: svgCardDataUri({
        bg1: '#3b0764',
        bg2: '#1e1b4b',
        accent: '#d946ef',
        title: 'Venom Beetle GX',
        hp: '220 HP',
        type: 'POISON / BUG • ULTRA RARE',
        footer: '⚡ Toxic Carapace — 140 DMG',
        iconSvg: `
          <circle r="76" fill="#a855f7" opacity="0.18"/>
          <g stroke="#e879f9" stroke-width="5" stroke-linecap="round" fill="none">
            <path d="M-36 -18 L-68 -36"/><path d="M-40 6 L-74 6"/><path d="M-34 30 L-64 50"/>
            <path d="M36 -18 L68 -36"/><path d="M40 6 L74 6"/><path d="M34 30 L64 50"/>
            <path d="M-16 -46 Q-32 -76 -52 -72"/><path d="M16 -46 Q32 -76 52 -72"/>
          </g>
          <circle cx="-53" cy="-72" r="6" fill="#4ade80"/><circle cx="53" cy="-72" r="6" fill="#4ade80"/>
          <ellipse cx="0" cy="-36" rx="24" ry="18" fill="#581c87" stroke="#f0abfc" stroke-width="3"/>
          <circle cx="-10" cy="-40" r="5" fill="#4ade80"/><circle cx="10" cy="-40" r="5" fill="#4ade80"/>
          <ellipse cx="0" cy="12" rx="40" ry="48" fill="#9333ea" stroke="#f5d0fe" stroke-width="3.5"/>
          <line x1="0" y1="-34" x2="0" y2="60" stroke="#2e1065" stroke-width="3"/>
          <circle cx="-18" cy="-2" r="7" fill="#4ade80"/><circle cx="18" cy="-2" r="7" fill="#4ade80"/>
          <circle cx="-20" cy="24" r="9" fill="#f0abfc"/><circle cx="20" cy="24" r="9" fill="#f0abfc"/>
        `
      }),
      sold: false,
      createdAt: '2026-10-31T14:00:00.000Z'
    },
    {
      id: 'starter-emerald-mantis',
      name: 'Neon Fang Mantis Holo',
      price: 8.50,
      rarity: 'Holo Rare',
      description: 'Shimmering emerald-and-violet foil card with sharp corners.',
      imageData: svgCardDataUri({
        bg1: '#064e3b',
        bg2: '#2e1065',
        accent: '#4ade80',
        title: 'Neon Mantis',
        hp: '160 HP',
        type: 'FOREST / POISON • HOLO RARE',
        footer: '🌿 Acid Slash — 95 DMG',
        iconSvg: `
          <circle r="74" fill="#4ade80" opacity="0.16"/>
          <polygon points="0,-64 52,-12 24,58 -24,58 -52,-12" fill="#10b981" fill-opacity="0.35" stroke="#4ade80" stroke-width="3"/>
          <path d="M-46 -6 L-18 -28 L-6 8 Z" fill="#a855f7" stroke="#f0abfc" stroke-width="2.5"/>
          <path d="M46 -6 L18 -28 L6 8 Z" fill="#a855f7" stroke="#f0abfc" stroke-width="2.5"/>
          <polygon points="0,-42 28,-8 0,38 -28,-8" fill="#059669" stroke="#bbf7d0" stroke-width="3"/>
          <circle cx="-11" cy="-14" r="6" fill="#fde047"/><circle cx="11" cy="-14" r="6" fill="#fde047"/>
        `
      }),
      sold: false,
      createdAt: '2026-10-31T13:55:00.000Z'
    },
    {
      id: 'starter-amethyst-drake',
      name: 'Amethyst Stinger Dragon',
      price: 22.00,
      rarity: 'Secret Rare',
      description: 'Ultra-clean gold & purple border Secret Rare from the PoisonBug vault.',
      imageData: svgCardDataUri({
        bg1: '#4c1d95',
        bg2: '#31102f',
        accent: '#facc15',
        title: 'Amethyst Dragon',
        hp: '280 HP',
        type: 'DRAGON / VENOM • SECRET RARE',
        footer: '🔥 Royal Stinger — 210 DMG',
        iconSvg: `
          <circle r="78" fill="#facc15" opacity="0.15"/>
          <path d="M-72 -18 Q-35 -68 0 -22 Q35 -68 72 -18 Q42 28 0 58 Q-42 28 -72 -18 Z" fill="#7e22ce" stroke="#fde047" stroke-width="3.5"/>
          <polygon points="0,-58 20,-10 0,40 -20,-10" fill="#eab308" opacity="0.88"/>
          <circle cx="-18" cy="-14" r="5" fill="#ffffff"/><circle cx="18" cy="-14" r="5" fill="#ffffff"/>
        `
      }),
      sold: false,
      createdAt: '2026-10-31T13:50:00.000Z'
    },
    {
      id: 'starter-crystal-moth',
      name: 'Starlight Spore Moth',
      price: 5.00,
      rarity: 'Mint',
      description: 'Glowing lunar moth card with holographic spore dust pattern.',
      imageData: svgCardDataUri({
        bg1: '#1e1b4b',
        bg2: '#4a044e',
        accent: '#38bdf8',
        title: 'Spore Moth',
        hp: '120 HP',
        type: 'COSMIC / BUG • MINT',
        footer: '✨ Sleep Powder — 70 DMG',
        iconSvg: `
          <circle r="72" fill="#38bdf8" opacity="0.15"/>
          <ellipse cx="-34" cy="-10" rx="34" ry="24" transform="rotate(-20 -34 -10)" fill="#8b5cf6" stroke="#7dd3fc" stroke-width="3"/>
          <ellipse cx="34" cy="-10" rx="34" ry="24" transform="rotate(20 34 -10)" fill="#8b5cf6" stroke="#7dd3fc" stroke-width="3"/>
          <ellipse cx="-26" cy="24" rx="22" ry="16" transform="rotate(18 -26 24)" fill="#ec4899" stroke="#bae6fd" stroke-width="2.5"/>
          <ellipse cx="26" cy="24" rx="22" ry="16" transform="rotate(-18 26 24)" fill="#ec4899" stroke="#bae6fd" stroke-width="2.5"/>
          <ellipse cx="0" cy="6" rx="9" ry="34" fill="#e0f2fe"/>
          <circle cx="-36" cy="-12" r="8" fill="#38bdf8"/><circle cx="36" cy="-12" r="8" fill="#38bdf8"/>
        `
      }),
      sold: false,
      createdAt: '2026-10-31T13:45:00.000Z'
    }
  ];
});
