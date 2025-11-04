# SABISCORE Logo - ASCII Art Reference

**Version:** v2.0 Enhanced  
**Date:** November 2, 2025

---

## Icon (48×48) - ASCII Representation

```
                    ╱▔▔▔▔▔▔▔▔▔▔▔▔▔╲
                 ╱▔▔                 ▔▔╲
              ╱▔▔    ┏━━━━━━━━━━┓      ▔▔╲
           ╱▔▔       ┃          ┃         ▔▔╲
        ╱▔▔          ┃   ┏━━┓   ┃            ▔▔╲
      ╱              ┃   ┃🏆┃   ┃               ╲
     ▏               ┃   ┗━━┛   ┃                ▕
     ▏      ○        ┃          ┃        ○       ▕
     ▏      ┃        ┃   ━━━━   ┃        ┃       ▕
     ▏      ┃        ┃   ▁▁▁▁   ┃        ┃       ▕
     ▏      ○━━━━━━━━┃          ┃━━━━━━━━○       ▕
     ▏               ┗━━━━━━━━━━┛                ▕
      ╲                                         ╱
        ╲▁▁                                 ▁▁╱
           ╲▁▁                         ▁▁╱
              ╲▁▁                   ▁▁╱
                 ╲▁▁             ▁▁╱
                    ╲▁▁▁▁▁▁▁▁▁▁▁╱

Legend:
╱╲  = Outer hexagonal shield (cyan gradient)
┏━┓ = Inner tech border
🏆  = Trophy cup
○   = Circuit pattern nodes
━   = Connection lines
```

---

## Wordmark (240×48) - ASCII Representation

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                            ┃
┃   ╱▔╲                                                      ┃
┃  ╱🏆 ╲   SABISCORE                                         ┃
┃  ╲  ╱                                                      ┃
┃   ╲▁╱   LIVE SCORES • ZERO ADS                            ┃
┃                                                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Legend:
┏━┓ = Gradient container (#0F0F0F → #1C1C1C)
╱╲  = Compact icon (32×32)
🏆  = Trophy detail
Text = Montserrat Black 28px
Tagline = Inter Medium 12px
```

---

## Monogram (24×24) - ASCII Representation

```
┏━━━━━━━━━━━━━━━━━━┓
┃                  ┃
┃      ╱▔╲         ┃
┃     ╱  ╲        ┃
┃    ▏ 🏆 ▕       ┃
┃     ╲  ╱        ┃
┃      ╲▁╱         ┃
┃                  ┃
┗━━━━━━━━━━━━━━━━━━┛

Legend:
┏━┓ = Rounded square (6px corners)
╱╲  = Simplified shield
🏆  = Trophy (minimal detail)
Background = #0F0F0F dark
```

---

## Color Palette (Visual)

```
PRIMARY CYAN:
█████████ #00D4FF (Cyan)
█████████ 
█████████ Used for: Logo accents, highlights, glow

DARK BACKGROUND:
█████████ #0F0F0F → #1C1C1C (Gradient)
█████████
█████████ Used for: Container backgrounds, base

WHITE:
█████████ #FFFFFF (White)
█████████
█████████ Used for: Logo elements, text, trophy

GRAY:
█████████ #A0A0A0 (Gray)
█████████
█████████ Used for: Taglines, secondary text
```

---

## Pull-to-Refresh Animation (Frames)

```
Frame 1 (0ms):          Frame 2 (20ms):         Frame 3 (40ms):
     ╱▔╲                    ╱ ▔╲                   ╱  ╲
    ╱🏆 ╲                  ╱  🏆╲                 ▏🏆  ▕
    ╲  ╱                  ╲ 🏆 ╱                 ╲   ╱
     ╲▁╱                    ╲▁ ╱                   ╲ ▁╱
   0° rotation            90° rotation          180° rotation

Frame 4 (60ms):         Frame 5 (80ms):
    ╲  ╱                    ╱▔╲
    ╱🏆 ╲                  ╱🏆 ╲
    ╲  ╱                  ╲  ╱
    ╱ ▁╲                    ╲▁╱
  270° rotation          360° rotation (complete)

Duration: 80ms total
Easing: ease-out
```

---

## Hover Effect (Scale + Glow)

```
NORMAL STATE:
     ╱▔╲           Scale: 1.0
    ╱🏆 ╲          Glow: 15% opacity
    ╲  ╱           
     ╲▁╱            

HOVER STATE:
      ╱▔╲          Scale: 1.05 (5% larger)
     ╱🏆 ╲         Glow: 25% opacity (brighter)
     ╲  ╱          Shadow: 0 6px 12px rgba(cyan, 0.25)
      ╲▁╱           

Transition: 150ms ease-out
```

---

## Responsive Breakpoints

```
DESKTOP (>768px):
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                    ┃
┃   ╱▔╲   SABISCORE                 ┃   240px wide
┃  ╱🏆 ╲  LIVE SCORES • ZERO ADS    ┃   12px tagline
┃  ╲  ╱                             ┃
┃   ╲▁╱                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

TABLET (480-768px):
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                            ┃
┃  ╱▔╲   SABISCORE          ┃   200px wide
┃ ╱🏆 ╲  LIVE • ZERO ADS    ┃   10px tagline
┃ ╲  ╱                      ┃
┃  ╲▁╱                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

MOBILE (<480px):
┏━━━━━━━━━━━━━━━━━┓
┃                 ┃
┃     ╱▔╲         ┃   160px wide
┃    ╱🏆 ╲        ┃   Icon only or
┃    ╲  ╱        ┃   monogram
┃     ╲▁╱         ┃
┗━━━━━━━━━━━━━━━━━┛

FAVICON (16×16):
┏━━━━━━━━━┓
┃  ╱▔╲   ┃   24px → 16px
┃ ╱🏆╲   ┃   Monogram
┃ ╲ ╱   ┃   Simplified
┃  ╲▁╱   ┃
┗━━━━━━━━━┛
```

---

## Circuit Pattern Detail

```
Full Icon with Circuit Nodes:

        ○ ━━━━━━━━━━━━━━━ ○
        ┃                  ┃
        ┃     ╱▔▔▔╲       ┃
        ┃    ╱  🏆  ╲      ┃
        ┃   ▏   ⚽   ▕     ┃
        ┃    ╲     ╱      ┃
        ┃     ╲▁▁▁╱       ┃
        ┃                  ┃
        ○ ━━━━━━━━━━━━━━━ ○

Legend:
○ = Circuit nodes (4 corners)
━ = Connection lines
┃ = Vertical connections
⚽ = Football detail (center)
🏆 = Trophy (main element)

Opacity: 40%
Color: #00D4FF (cyan)
Stroke Width: 0.8px
```

---

## Trophy Detail Breakdown

```
Trophy Structure (Icon):

         ╭─────╮  ← Handles
         │     │
         │ ╭─╮ │  ← Cup
         │ │⚽│ │  ← Football
         │ ╰─╯ │
         │     │
         ╰──┬──╯
            │     ← Stem
         ╭──┴──╮
         │     │  ← Base
         ╰─────╯

Colors:
Handles = #FFFFFF (white stroke)
Cup = #FFFFFF → #E0E0E0 (gradient)
Football = #00D4FF (cyan) + #FFFFFF (details)
Stem = #FFFFFF (white)
Base = #FFFFFF (white)
```

---

## Usage Examples (ASCII)

### Landing Page Hero

```
════════════════════════════════════════════════════
                                                    
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓            
        ┃   ╱▔╲   SABISCORE          ┃            
        ┃  ╱🏆 ╲  LIVE SCORES • 0 ADS┃            
        ┃  ╲  ╱                      ┃            
        ┃   ╲▁╱                       ┃            
        ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛            
                                                    
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓            
        ┃  🤖 AI Match Intelligence  ┃            
        ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛            
                                                    
        Data-driven forecasts for every            
        elite European clash                       
                                                    
        [Analyze Match] [Latest Insights]          
                                                    
════════════════════════════════════════════════════
```

### App Header

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ╱▔╲   SABISCORE            🔍[Search] 👤    ┃
┃ ╱🏆 ╲                                         ┃
┃ ╲  ╱                                         ┃
┃  ╲▁╱                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Mobile View

```
┏━━━━━━━━━━━━━━━━━━┓
┃  ╱▔╲   ☰         ┃
┃ ╱🏆 ╲            ┃
┃ ╲  ╱            ┃
┃  ╲▁╱             ┃
┣━━━━━━━━━━━━━━━━━━┫
┃                  ┃
┃  [Team Picker]   ┃
┃                  ┃
┃  MAN UTD ⚽ LIV   ┃
┃                  ┃
┗━━━━━━━━━━━━━━━━━━┛
```

---

## Implementation Code Reference

### React Component

```tsx
import Logo from './components/Logo';

// Wordmark (hero)
<Logo variant="wordmark" size={240} />

// Icon (header) with animation
<Logo 
  variant="icon" 
  size={48} 
  animated={isPullingToRefresh} 
/>

// Monogram (favicon)
<link rel="icon" href="/assets/logos/sabiscore-monogram.svg" />
```

### CSS Animation

```css
.logo-spin-animation {
  animation: logoSpin 80ms ease-out;
}

@keyframes logoSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Image Fallback

```tsx
<img 
  src={team.crest}
  onError={(e) => {
    e.currentTarget.src = 'data:image/svg+xml,...'; // Cyan "?" placeholder
  }}
/>
```

---

## Quick Reference

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ SABISCORE LOGO SYSTEM v2.0                    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                ┃
┃ Variants:                                      ┃
┃   • Icon (48×48)     → Headers, profile       ┃
┃   • Wordmark (240×48) → Landing page          ┃
┃   • Monogram (24×24)  → Favicons              ┃
┃                                                ┃
┃ Colors:                                        ┃
┃   • Cyan:  #00D4FF  (primary)                 ┃
┃   • Dark:  #0F0F0F  (background)              ┃
┃   • White: #FFFFFF  (text/elements)           ┃
┃   • Gray:  #A0A0A0  (secondary)               ┃
┃                                                ┃
┃ Features:                                      ┃
┃   ✅ 3D trophy shield                          ┃
┃   ✅ Circuit pattern                           ┃
┃   ✅ Pull-to-refresh (80ms)                    ┃
┃   ✅ Responsive (16px → 240px)                 ┃
┃   ✅ Accessible (WCAG AAA)                     ┃
┃                                                ┃
┃ Status: ✅ PRODUCTION READY                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

**ASCII Art Reference Complete**  
**Status:** ✅ Visual guide ready  
**Use:** Quick reference for logo structure
