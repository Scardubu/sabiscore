import React from 'react';
import SafeImage from './SafeImage';
import { BRAND, getPreferredLogoPath, getFallbackLogoPath } from '../branding';

interface LogoProps {
  variant?: 'icon' | 'wordmark' | 'monogram';
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * SABISCORE Logo Component
 * 
 * Usage:
 * - <Logo variant="wordmark" size={240} /> - Full branding
 * - <Logo variant="icon" size={48} /> - Standard icon
 * - <Logo variant="monogram" size={24} /> - Compact/favicon
 * 
 * @param variant - Logo style: icon (48x48), wordmark (240x48), monogram (24x24)
 * @param size - Override default size in pixels
 * @param className - Additional CSS classes
 * @param animated - Enable pull-to-refresh animation
 */
const Logo: React.FC<LogoProps> = ({ 
  variant = 'icon', 
  size, 
  className = '', 
  animated = false 
}) => {
  const preferred = getPreferredLogoPath(variant);
  const fallback = getFallbackLogoPath(variant);

  const getDefaultSize = () => {
    switch (variant) {
      case 'wordmark':
        return size || BRAND.sizes.wordmark;
      case 'monogram':
        return size || BRAND.sizes.monogram;
      case 'icon':
      default:
        return size || BRAND.sizes.icon;
    }
  };

  const logoSize = getDefaultSize();
  const animationClass = animated ? 'logo-spin-animation' : '';

  const height = variant === 'wordmark' ? Math.round(logoSize / 5) : logoSize;

  return (
    <SafeImage
      src={preferred}
      fallback={fallback}
      alt="SABISCORE - AI Football Intelligence"
      width={logoSize}
      height={height}
      className={`sabiscore-logo ${animationClass} ${className}`}
      decoding="async"
      loading="eager"
    />
  );
};

export default Logo;
