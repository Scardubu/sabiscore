const FONT_LINKS = [
  {
    id: 'sabiscore-fontshare-clash-display',
    href: 'https://api.fontshare.com/v2/css?f[]=clashdisplay@400,500,600,700&display=swap'
  },
  {
    id: 'sabiscore-google-fonts-core',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@600;700&family=Poppins:wght@500;600&display=swap'
  }
];

const PRECONNECTS = [
  { href: 'https://fonts.googleapis.com' },
  { href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { href: 'https://api.fontshare.com' }
];

let fontsInitialized = false;

function ensureHead() {
  if (typeof document === 'undefined') return null;
  return document.head || document.getElementsByTagName('head')[0];
}

function appendPreconnect(head) {
  PRECONNECTS.forEach(({ href, crossOrigin }) => {
    if (!href || head.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    if (crossOrigin) {
      link.crossOrigin = crossOrigin;
    }
    head.appendChild(link);
  });
}

function appendStylesheets(head) {
  FONT_LINKS.forEach(({ id, href }) => {
    if (!href || head.querySelector(`link[data-font-id="${id}"]`)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-font-id', id);
    head.appendChild(link);
  });
}

function markFontsReady() {
  const html = document.documentElement;
  html.classList.remove('fonts-loading');
  html.classList.add('fonts-ready');
  html.dataset.fontsLoaded = 'true';
}

export function initTypography() {
  if (fontsInitialized || typeof document === 'undefined') {
    return;
  }

  const head = ensureHead();
  if (!head) {
    return;
  }

  const html = document.documentElement;
  if (html.dataset.fontsLoaded === 'true') {
    fontsInitialized = true;
    return;
  }

  html.classList.add('fonts-loading');
  appendPreconnect(head);
  appendStylesheets(head);

  const finalize = () => {
    if (!fontsInitialized) {
      fontsInitialized = true;
      markFontsReady();
    }
  };

  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(finalize).catch(finalize);
  } else {
    // Fallback for browsers without Font Loading API support
    setTimeout(finalize, 1000);
  }
}

export default initTypography;
