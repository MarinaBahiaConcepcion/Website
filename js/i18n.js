// ================================================================
// English / Spanish toggle.
// Elements opt in with data-i18n (innerHTML) or data-i18n-aria
// (aria-label). Runs standalone so the copy still translates even
// if the Three.js scene fails to load.
// ================================================================

const translations = {
  en: {
    pageTitle: 'Marina Bahía Concepción · Coming Soon · Baja California Sur, México',
    metaDescription:
      'A private marina & resort on the Sea of Cortés. Docks, mooring buoys, club house, beach cabañas and more, coming soon to Bahía Concepción, Baja California Sur, México.',
    langToggleAria: 'Cambiar a español',
    heroEyebrow: 'Bahía Concepción&ensp;·&ensp;Sea of Cortés',
    heroSub: 'A private marina &amp; resort on the most beautiful bay in Baja',
    comingSoon: 'Coming&ensp;Soon',
    scrollCue: 'Scroll to learn more',
    visionEyebrow: 'The Vision',
    visionTitle: 'Anchor in paradise',
    visionLead:
      "On the protected western shore of Bahía Concepción, where the desert meets turquoise water, a private harbor is taking shape. Arrive by sea and step off your yacht onto the dock, or arrive by land and disappear into a cabaña at the water's edge. Swim, sail, dine, and watch the sun set over the Sierra.",
    amenitiesEyebrow: "What's to Come",
    amenitiesTitle: 'The Marina &amp; Resort',
    dockTitle: 'Private Dock',
    dockDesc: 'Direct boat access from deep water. Tie up steps from the club house.',
    buoysTitle: 'Mooring Buoys',
    buoysDesc: 'Protected moorings for sailboats in the calm of the bay, season after season.',
    clubTitle: 'Club House',
    clubDesc: 'Lounge, restaurant &amp; bar, and an outdoor deck overlooking the water.',
    poolTitle: 'Pool',
    poolDesc: 'A pool overlooking the bay. Swim with the Sea of Cortés on the horizon.',
    beachTitle: 'Beach Access',
    beachDesc: 'A private stretch of sand with kayaks and paddle boards at the ready.',
    cabanasTitle: 'Ten Cabañas',
    cabanasDesc: 'Nos. 1 to 5 face the ocean at dawn; Nos. 6 to 10 face the sunset over the Sierra.',
    fireTitle: 'Fire Pit',
    fireDesc: 'A gathering place under some of the darkest, starriest skies in México.',
    parkingTitle: 'Parking',
    parkingDesc: 'Arriving down Highway 1? Secure on-site parking awaits.',
    locationEyebrow: 'The Location',
    locationLead:
      'South of Mulegé on the Sea of Cortés, a 40&#8239;km bay of white-sand coves and impossibly clear water, sheltered by the Concepción peninsula.',
    mapLink: 'View on Google Maps',
    footerFine: 'In development. Opening to be announced.<br />© 2026 marinabahiaconcepcion.com',
  },
  es: {
    pageTitle: 'Marina Bahía Concepción · Próximamente · Baja California Sur, México',
    metaDescription:
      'Una marina y resort privados en el Mar de Cortés. Muelles, boyas de amarre, casa club, cabañas frente a la playa y más, próximamente en Bahía Concepción, Baja California Sur, México.',
    langToggleAria: 'Switch to English',
    heroEyebrow: 'Bahía Concepción&ensp;·&ensp;Mar de Cortés',
    heroSub: 'Una marina y resort privados en la bahía más hermosa de Baja California',
    comingSoon: 'Próximamente',
    scrollCue: 'Desplácese para saber más',
    visionEyebrow: 'La Visión',
    visionTitle: 'Ancle en el paraíso',
    visionLead:
      'En la orilla occidental protegida de Bahía Concepción, donde el desierto se encuentra con aguas turquesa, un puerto privado está tomando forma. Llegue por mar y baje de su yate directo al muelle, o llegue por tierra y piérdase en una cabaña a la orilla del agua. Nade, navegue, cene y contemple la puesta de sol sobre la Sierra.',
    amenitiesEyebrow: 'Lo Que Viene',
    amenitiesTitle: 'Marina y Resort',
    dockTitle: 'Muelle Privado',
    dockDesc: 'Acceso directo para embarcaciones desde aguas profundas. Amarre a unos pasos de la casa club.',
    buoysTitle: 'Boyas de Amarre',
    buoysDesc: 'Amarres protegidos para veleros en la calma de la bahía, temporada tras temporada.',
    clubTitle: 'Casa Club',
    clubDesc: 'Lounge, restaurante y bar, y una terraza al aire libre con vista al agua.',
    poolTitle: 'Alberca',
    poolDesc: 'Una alberca con vista a la bahía. Nade con el Mar de Cortés en el horizonte.',
    beachTitle: 'Acceso a la Playa',
    beachDesc: 'Un tramo privado de arena con kayaks y tablas de remo listos para usar.',
    cabanasTitle: 'Diez Cabañas',
    cabanasDesc: 'Las cabañas 1 a 5 miran al mar al amanecer; las 6 a 10, al atardecer sobre la Sierra.',
    fireTitle: 'Fogata',
    fireDesc: 'Un punto de reunión bajo uno de los cielos más oscuros y estrellados de México.',
    parkingTitle: 'Estacionamiento',
    parkingDesc: '¿Llega por la Carretera 1? Le espera estacionamiento seguro dentro del complejo.',
    locationEyebrow: 'La Ubicación',
    locationLead:
      'Al sur de Mulegé sobre el Mar de Cortés, una bahía de 40&#8239;km con calas de arena blanca y aguas increíblemente claras, resguardada por la península de Concepción.',
    mapLink: 'Ver en Google Maps',
    footerFine: 'En desarrollo. Fecha de apertura por anunciar.<br />© 2026 marinabahiaconcepcion.com',
  },
};

const STORAGE_KEY = 'mbc-lang';

function initialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // storage unavailable (private mode); fall back to browser language
  }
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}

let lang = initialLang();

function apply() {
  const dict = translations[lang];

  document.documentElement.lang = lang;
  document.title = dict.pageTitle;
  document
    .querySelector('meta[name="description"]')
    .setAttribute('content', dict.metaDescription);

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = dict[el.dataset.i18n];
    if (value !== undefined) el.innerHTML = value;
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const value = dict[el.dataset.i18nAria];
    if (value !== undefined) el.setAttribute('aria-label', value);
  });

  document.querySelectorAll('.lang-toggle').forEach((btn) => {
    btn.textContent = lang === 'en' ? 'Español' : 'English';
    btn.setAttribute('aria-label', dict.langToggleAria);
  });
}

document.querySelectorAll('.lang-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = lang === 'en' ? 'es' : 'en';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // preference just won't persist
    }
    apply();
  });
});

apply();
