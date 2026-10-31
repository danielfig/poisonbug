(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  }
  if (typeof root !== 'undefined') {
    root.POISONBUG_STARTER_CARDS = data;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return [
    {
      id: 'poke-mew-ex-232',
      name: 'Mew ex (232/091)',
      price: 89.99,
      grade: 'Gem Mint',
      finish: 'Textured / Special Illustration Foil',
      description: 'Paldean Fates Special Illustration Rare "Bubble Mew" in pristine penny sleeve & top loader.',
      imageData: './cards/mew-ex.webp',
      sold: false,
      createdAt: '2026-10-31T14:30:00.000Z'
    },
    {
      id: 'poke-charizard-ex-xy121',
      name: 'Charizard EX (XY121)',
      price: 42.00,
      grade: 'Near Mint',
      finish: 'Full Art Foil',
      description: 'XY Black Star Promo Full Art Holo Charizard EX with fiery artwork and clean edges.',
      imageData: './cards/charizard-ex.webp',
      sold: false,
      createdAt: '2026-10-31T14:25:00.000Z'
    },
    {
      id: 'poke-gengar-fossil-5',
      name: 'Gengar (Fossil #5)',
      price: 54.99,
      grade: 'Mint',
      finish: 'Holo Foil',
      description: 'Classic vintage Fossil Set holographic Gengar — iconic Poison/Ghost Pokémon card!',
      imageData: './cards/gengar-holo.webp',
      sold: false,
      createdAt: '2026-10-31T14:20:00.000Z'
    },
    {
      id: 'poke-pikachu-ex-xy84',
      name: 'Pikachu EX (XY84)',
      price: 34.50,
      grade: 'Near Mint',
      finish: 'Full Art Foil',
      description: 'Promo Full Art Pikachu EX with electric lightning background foil.',
      imageData: './cards/pikachu-ex.webp',
      sold: false,
      createdAt: '2026-10-31T14:15:00.000Z'
    },
    {
      id: 'poke-radiant-eevee-swsh230',
      name: 'Radiant Eevee (SWSH230)',
      price: 11.99,
      grade: 'Mint',
      finish: 'Radiant / Sparkle Foil',
      description: 'Pokémon GO Promo Radiant Eevee with crosshatch sparkle holo foil pattern.',
      imageData: './cards/radiant-eevee.webp',
      sold: false,
      createdAt: '2026-10-31T14:10:00.000Z'
    },
    {
      id: 'poke-eevee-jungle-51',
      name: 'Eevee (Jungle #51)',
      price: 4.50,
      grade: 'Lightly Played',
      finish: 'Normal (Non-Foil)',
      description: 'Original vintage Jungle Set non-holo normal Eevee card.',
      imageData: './cards/eevee-normal.webp',
      sold: false,
      createdAt: '2026-10-31T14:05:00.000Z'
    }
  ];
});
