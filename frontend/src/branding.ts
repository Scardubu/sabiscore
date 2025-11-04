// Centralized branding configuration for SabiScore UI
// Swap the active logo without touching components

export type LogoChoice = 'sabi1' | 'sabi3';

export const BRAND = {
  // Choose which provided PNG to use by default
  logo: 'sabi3' as LogoChoice,
  // Base folder (placed under /public)
  publicDir: '/brand',
  // Heights for each variant (wordmark is wider; icon/monogram are square)
  sizes: {
    icon: 48,
    monogram: 24,
    wordmark: 240,
  },
} as const;

export const getPreferredLogoPath = (variant: 'icon' | 'wordmark' | 'monogram') => {
  // Map variant to the configured PNG filename if present
  const map: Record<typeof BRAND.logo, Record<string, string>> = {
    sabi1: {
      icon: `${BRAND.publicDir}/Sabi1.png`,
      wordmark: `${BRAND.publicDir}/Sabi1.png`,
      monogram: `${BRAND.publicDir}/Sabi1.png`,
    },
    sabi3: {
      icon: `${BRAND.publicDir}/Sabi3.png`,
      wordmark: `${BRAND.publicDir}/Sabi3.png`,
      monogram: `${BRAND.publicDir}/Sabi3.png`,
    },
  };
  return map[BRAND.logo][variant];
};

export const getFallbackLogoPath = (variant: 'icon' | 'wordmark' | 'monogram') => {
  switch (variant) {
    case 'wordmark':
      return '/sabiscore-wordmark.svg';
    case 'monogram':
      return '/sabiscore-monogram.svg';
    case 'icon':
    default:
      return '/sabiscore-icon.svg';
  }
};
