# SABISCORE Brand Guidelines

**Version:** 2.0  
**Date:** November 2, 2025  
**Status:** ✅ Active

---

## 🎨 Brand Identity

### Overview
SABISCORE represents the intersection of artificial intelligence and sports analytics. The brand identity communicates:
- **Technology**: Modern, AI-powered intelligence
- **Precision**: Data-driven insights and accuracy
- **Achievement**: Trophy/winning symbolism
- **Accessibility**: "Live Scores • Zero Ads"

---

## 🏆 Logo System

### Logo Variants

#### 1. **Wordmark** (Primary)
- **File:** `sabiscore-wordmark.svg`
- **Dimensions:** 240px × 48px
- **Usage:** Main headers, landing pages, marketing materials
- **Minimum Width:** 180px
- **Clear Space:** 16px on all sides

#### 2. **Icon** (Standard)
- **File:** `sabiscore-icon.svg`
- **Dimensions:** 48px × 48px
- **Usage:** App icons, profile images, social media avatars
- **Minimum Size:** 32px
- **Clear Space:** 8px on all sides

#### 3. **Monogram** (Compact)
- **File:** `sabiscore-monogram.svg`
- **Dimensions:** 24px × 24px
- **Usage:** Favicons, small UI elements, tight spaces
- **Minimum Size:** 16px
- **Clear Space:** 4px on all sides

### Logo Usage Rules

✅ **DO:**
- Maintain aspect ratio at all times
- Use on approved background colors only
- Ensure minimum size requirements
- Preserve clear space around logo
- Use provided SVG files for web
- Apply subtle drop shadow when needed (max 10% opacity)

❌ **DON'T:**
- Stretch, skew, or rotate the logo
- Change logo colors outside brand palette
- Place on busy backgrounds without backdrop
- Add effects beyond approved shadow
- Recreate or redraw the logo
- Use raster images below 2x resolution

---

## 🎨 Color Palette

### Primary Colors

#### **Cyan** (Brand Primary)
```css
--primary: #00D4FF
--primary-light: #33DDFF
--primary-dark: #0095CC
```
- **Usage:** Primary actions, links, highlights, logo accent
- **RGB:** 0, 212, 255
- **Accessibility:** AA compliant on dark backgrounds

#### **Dark Background** (Base)
```css
--dark-bg: #0F0F0F
--dark-bg-alt: #1C1C1C
```
- **Usage:** Main background, headers, cards
- **Gradient:** `linear-gradient(180deg, #0F0F0F 0%, #1C1C1C 100%)`

#### **White** (Text Primary)
```css
--white: #FFFFFF
```
- **Usage:** Primary text, icons, logo on dark
- **Contrast Ratio:** 14:1 on #0F0F0F (AAA)

### Secondary Colors

#### **Subtle Gray**
```css
--gray-400: #A0A0A0
```
- **Usage:** Subtitles, taglines, secondary text
- **Contrast Ratio:** 4.54:1 on #0F0F0F (AA)

#### **Gold Accent**
```css
--accent: #F8B500
--accent-light: #FFD54F
--accent-dark: #F9A825
```
- **Usage:** Success states, premium features, highlights

#### **Green Success**
```css
--success: #10b981
```
- **Usage:** Positive predictions, confirmation states

### Gradients

#### **Primary Gradient**
```css
background: linear-gradient(135deg, #00D4FF 0%, #0095CC 100%);
```
- **Usage:** CTAs, featured cards, progress bars

#### **Header Gradient**
```css
background: linear-gradient(180deg, #0F0F0F 0%, #1C1C1C 100%);
```
- **Usage:** App header, navigation bars

#### **Cyber Gradient**
```css
background: linear-gradient(135deg, #00D4FF 0%, #7B2FF7 100%);
```
- **Usage:** Premium features, special promotions

---

## ✍️ Typography

### Font Families

#### **Display Font: Montserrat Black**
```css
font-family: 'Montserrat', var(--font-family-display);
font-weight: 900;
```
- **Usage:** Logo text, hero titles, metrics
- **Fallback:** System sans-serif stack
- **Letter Spacing:** -0.5px for sizes >28px

#### **Body Font: Inter**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```
- **Usage:** All body text, UI elements
- **Weights:** 400 (Regular), 500 (Medium), 600 (Semibold)

### Type Scale

| Size | CSS Variable | px | Usage |
|------|-------------|-----|-------|
| **3XL** | `--font-size-3xl` | 40px | Hero headlines |
| **2XL** | `--font-size-2xl` | 28px | Logo text, section titles |
| **XL** | `--font-size-xl` | 24px | Card headers |
| **LG** | `--font-size-lg` | 20px | Subheadings |
| **Base** | `--font-size-base` | 16px | Body text |
| **SM** | `--font-size-sm` | 12px | Captions, taglines |
| **XS** | `--font-size-xs` | 10px | Fine print |

### Typography Hierarchy

#### **Logo Text**
```css
font-family: 'Montserrat', sans-serif;
font-size: 28px;
font-weight: 900;
letter-spacing: -0.5px;
color: #FFFFFF;
```

#### **Tagline**
```css
font-family: 'Inter', sans-serif;
font-size: 12px;
font-weight: 500;
letter-spacing: 0.5px;
text-transform: uppercase;
color: #A0A0A0;
```

#### **Body Text**
```css
font-family: 'Inter', sans-serif;
font-size: 16px;
font-weight: 400;
line-height: 1.5;
color: #FFFFFF;
```

---

## 📐 Spacing System (16dp Rhythm)

### Base Unit: 16px

| Name | CSS Variable | Value | Usage |
|------|-------------|-------|-------|
| **3XL** | `--space-3xl` | 64px | Page sections |
| **2XL** | `--space-2xl` | 48px | Major components |
| **XL** | `--space-xl` | 32px | Card padding |
| **LG** | `--space-lg` | 24px | Element groups |
| **MD** | `--space-md` | 16px | **Base rhythm** |
| **SM** | `--space-sm` | 8px | Small gaps |
| **XS** | `--space-xs` | 4px | Tight spacing |

### Vertical Rhythm
- All vertical spacing should be multiples of 16px
- Maintain consistent rhythm across components
- Use 16px, 32px, 48px, 64px for major sections

---

## 🎬 Animation Standards

### Logo Animation (Pull-to-Refresh)

```css
@keyframes logoSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.logo-spin-animation {
  animation: logoSpin 80ms ease-out;
}
```

### Transition Speeds

| Speed | Duration | Usage |
|-------|----------|-------|
| **Fast** | 150ms | Hover states, micro-interactions |
| **Normal** | 300ms | Standard transitions |
| **Slow** | 500ms | Large animations, page transitions |

### Easing Functions

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Hover Effects

#### **Buttons**
```css
button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
  transition: all 150ms ease-out;
}
```

#### **Cards**
```css
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(0, 212, 255, 0.3);
  transition: all 300ms ease-out;
}
```

---

## ♿ Accessibility

### Color Contrast

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| #FFFFFF on #0F0F0F | 14:1 | AAA ✅ |
| #00D4FF on #0F0F0F | 7.2:1 | AAA ✅ |
| #A0A0A0 on #0F0F0F | 4.54:1 | AA ✅ |

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  .logo-spin-animation {
    animation: none;
  }
  
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support

```html
<img 
  src="/assets/logos/sabiscore-icon.svg" 
  alt="SABISCORE - AI Football Intelligence"
  role="img"
/>
```

---

## 📱 Responsive Breakpoints

### Breakpoints

| Device | Breakpoint | Logo Variant | Font Scale |
|--------|-----------|--------------|------------|
| **Desktop** | >1024px | Wordmark (240px) | 100% |
| **Tablet** | 768-1024px | Wordmark (200px) | 95% |
| **Mobile** | 480-768px | Icon (48px) | 90% |
| **Small** | <480px | Monogram (32px) | 85% |

### Logo Responsive Behavior

```css
@media (max-width: 768px) {
  .sabiscore-logo {
    max-width: 180px;
  }
}

@media (max-width: 480px) {
  .sabiscore-logo {
    max-width: 120px;
  }
}
```

---

## 🎯 Component Standards

### Glass Cards

```css
.glass-card {
  background: rgba(17, 18, 32, 0.9);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 212, 255, 0.15);
}
```

### Buttons

#### **Primary CTA**
```css
.btn-primary {
  background: linear-gradient(135deg, #00D4FF 0%, #0095CC 100%);
  color: #FFFFFF;
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(0, 212, 255, 0.25);
}
```

#### **Secondary/Outline**
```css
.btn-outline {
  background: transparent;
  border: 2px solid rgba(0, 212, 255, 0.3);
  color: #00D4FF;
  padding: 14px 30px;
  border-radius: 12px;
}
```

---

## 📦 Asset Delivery

### File Formats

| Type | Format | Usage |
|------|--------|-------|
| **Web** | SVG | Preferred for all logos |
| **Social** | PNG (2x) | Open Graph images |
| **Print** | Vector (AI/PDF) | High-res materials |

### File Naming Convention

```
sabiscore-{variant}-{size}.{ext}

Examples:
- sabiscore-wordmark.svg
- sabiscore-icon-48.svg
- sabiscore-monogram-24.svg
```

### Directory Structure

```
/assets/logos/
├── sabiscore-wordmark.svg
├── sabiscore-icon.svg
├── sabiscore-monogram.svg
├── sabiscore-wordmark@2x.png
└── sabiscore-icon@2x.png
```

---

## ✅ Brand Checklist

### Logo Implementation
- [ ] All logos use approved SVG files
- [ ] Minimum size requirements met
- [ ] Clear space preserved
- [ ] Correct variant for context
- [ ] No unapproved modifications

### Color Usage
- [ ] Primary cyan (#00D4FF) for highlights
- [ ] Dark backgrounds (#0F0F0F/#1C1C1C)
- [ ] Subtle gray (#A0A0A0) for secondary text
- [ ] Accessible contrast ratios (AA minimum)

### Typography
- [ ] Montserrat Black for display text
- [ ] Inter for body text
- [ ] Correct font sizes from scale
- [ ] Proper letter spacing applied

### Spacing
- [ ] 16px base rhythm maintained
- [ ] Consistent vertical spacing
- [ ] Adequate padding on all components

### Animations
- [ ] 80ms logo spin on interactions
- [ ] Smooth hover transitions
- [ ] Reduced motion support enabled

---

## 📞 Support & Resources

### Design Assets
- **Location:** `/frontend/src/assets/logos/`
- **Figma:** [Link to design file]
- **Style Guide:** This document

### Component Library
- **Logo Component:** `/frontend/src/components/Logo.tsx`
- **CSS System:** `/frontend/src/css/design-system.css`
- **Logo Styles:** `/frontend/src/css/logo.css`

### Questions?
Contact the design team or reference this living document.

---

**Document Version:** 2.0  
**Last Updated:** November 2, 2025  
**Next Review:** December 2, 2025
