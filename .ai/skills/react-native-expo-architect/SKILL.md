---
name: react-native-expo-architect
description: >
  Designs and audits Expo SDK 54+ React Native applications using the New Architecture:
  TurboModules, Fabric renderer, Reanimated v4 (worklets), EAS Build configuration,
  Expo Router v4, shared code patterns with Next.js web apps, and production deployment
  via EAS. Use this skill whenever a user is building a React Native / Expo app, asks
  about New Architecture migration, Reanimated v4, EAS Build setup, Expo Router, sharing
  code between web and mobile, or says "set up Expo project", "migrate to New Architecture",
  "configure EAS Build", "Reanimated v4 animation", "Expo Router navigation", "share code
  between Next.js and Expo", "TypeScript for Expo", or "OTA update setup".
  Always use this skill for Expo/React Native work — New Architecture and Reanimated v4
  have breaking changes from SDK 53 that are easy to miss.
---

# React Native Expo Architect

Design and audit Expo SDK 54+ applications with the New Architecture. Every pattern is
tested with the New Architecture. Every animation uses Reanimated v4 worklets. Every
build goes through EAS.

## SDK 54 Critical Facts

- **New Architecture is default** — 75% of EAS builds already use it; SDK 55 makes it mandatory
- **Reanimated v4 only supports New Architecture** — requires `react-native-worklets` peer dep
- **`expo-av` deprecated** — migrate to `expo-audio` + `expo-video` before SDK 55
- **`expo-file-system`** — new stable API is default; legacy via `expo-file-system/legacy`
- **EAS Build defaults to Xcode 26** — test against iOS 26 Liquid Glass design system
- **React Native 0.81 + React 19.1** — React Compiler enabled by default

## Protocol

### Step 1 — Project Setup

```bash
# New project
npx create-expo-app@latest MyApp --template blank-typescript

# Upgrade existing project
npx expo install expo@54

# Install EAS CLI
npm install -g eas-cli
eas login
eas build:configure    # generates eas.json
```

**`app.json` (Expo config):**
```json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.example.myapp",
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png" },
      "package": "com.example.myapp",
      "versionCode": 1,
      "edgeToEdgeEnabled": true   // mandatory for Android 16+
    },
    "plugins": [
      "expo-router",
      ["expo-font", { "fonts": ["./assets/fonts/Inter-Regular.ttf"] }]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### Step 2 — Expo Router v4 Navigation

```
app/
  _layout.tsx          ← root layout (fonts, providers, safe area)
  (tabs)/
    _layout.tsx        ← tab bar layout
    index.tsx          ← tab 1: home
    profile.tsx        ← tab 2: profile
  (auth)/
    _layout.tsx        ← auth stack layout
    sign-in.tsx
    sign-up.tsx
  invoice/
    [id].tsx           ← dynamic route: /invoice/123
  +not-found.tsx       ← 404 handler
```

```tsx
// app/_layout.tsx — root layout
import { Stack }        from 'expo-router'
import { StatusBar }    from 'expo-status-bar'
import { useFonts }     from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect }    from 'react'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  })

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  )
}

// Navigation — fully typed with TypeScript
import { router, useLocalSearchParams } from 'expo-router'
router.push('/invoice/inv_123')
router.replace('/(auth)/sign-in')
const { id } = useLocalSearchParams<{ id: string }>()
```

### Step 3 — Reanimated v4 (New Architecture Only)

**Install:**
```bash
npx expo install react-native-reanimated react-native-worklets
# Note: remove react-native-reanimated/plugin from babel.config.js — handled by babel-preset-expo
```

**Remove from babel.config.js:**
```javascript
// ❌ Remove this — causes errors in SDK 54
module.exports = {
  plugins: ['react-native-reanimated/plugin'],  // ← DELETE THIS LINE
}
```

**Animation patterns:**
```tsx
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeOut, SlideInRight, Layout,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'

// ─── Shared value + animated style ───────────────────────
export function PressableCard() {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={animatedStyle}
      onTouchStart={()  => { scale.value = withSpring(0.96) }}
      onTouchEnd={()    => { scale.value = withSpring(1.0) }}
    >
      <Card />
    </Animated.View>
  )
}

// ─── Enter/exit animations ────────────────────────────────
<Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
  <Content />
</Animated.View>

// ─── List item animations (automatic layout transitions) ──
{items.map(item => (
  <Animated.View key={item.id} layout={Layout.springify()} entering={SlideInRight}>
    <ListItem item={item} />
  </Animated.View>
))}

// ─── Scroll-driven animation ─────────────────────────────
const scrollY = useSharedValue(0)
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => { scrollY.value = event.contentOffset.y },
})
const headerStyle = useAnimatedStyle(() => ({
  opacity: 1 - scrollY.value / 100,
}))
```

### Step 4 — Shared Code (Web + Mobile)

With Expo + Next.js in a Turborepo:

```
packages/
  ui/           ← shared components (with platform variants)
    Button.tsx
    Button.native.tsx   ← mobile-specific override
  hooks/        ← shared business logic
  api/          ← tRPC or type-safe API client
apps/
  web/          ← Next.js 15
  mobile/       ← Expo SDK 54
```

```tsx
// packages/ui/Button.tsx — web version
export function Button({ onPress, children }: ButtonProps) {
  return <button onClick={onPress}>{children}</button>
}

// packages/ui/Button.native.tsx — auto-used on mobile by Metro
export function Button({ onPress, children }: ButtonProps) {
  return (
    <Pressable onPress={onPress}>
      <Text>{children}</Text>
    </Pressable>
  )
}
```

### Step 5 — EAS Build Configuration

```json
// eas.json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "distribution": "store",
      "channel": "production",
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./service-account.json", "track": "internal" },
      "ios": { "appleId": "your@email.com", "ascAppId": "123456789" }
    }
  }
}
```

**Build commands:**
```bash
# Development build (for Expo Dev Client)
eas build --profile development --platform android

# Preview build (internal testing)
eas build --profile preview --platform all

# Production build (App Store / Play Store)
eas build --profile production --platform all

# Submit to stores
eas submit --profile production --platform all
```

### Step 6 — OTA Updates (expo-updates)

```typescript
// hooks/useOTAUpdate.ts
import * as Updates from 'expo-updates'
import { useEffect } from 'react'

export function useOTAUpdate() {
  useEffect(() => {
    async function checkForUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync()
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync()
          await Updates.reloadAsync()
        }
      } catch (err) {
        // silent — don't crash if OTA check fails
        console.warn('OTA check failed:', err)
      }
    }
    if (!__DEV__) checkForUpdate()   // only in production
  }, [])
}
```

## Quality Gates

- [ ] `newArchEnabled: true` in `app.json`
- [ ] `react-native-reanimated/plugin` removed from `babel.config.js`
- [ ] `react-native-worklets` installed as peer dep for Reanimated v4
- [ ] `expo-av` removed; replaced with `expo-audio` + `expo-video`
- [ ] `edgeToEdgeEnabled: true` for Android (mandatory Android 16+)
- [ ] EAS build succeeds for both iOS and Android
- [ ] `typedRoutes: true` in `app.json` experiments (typed navigation)
- [ ] `SafeAreaView` from `react-native-safe-area-context` (not built-in)

## Activation Triggers

- "Set up Expo project / Expo SDK 54"
- "Migrate to New Architecture"
- "Configure Reanimated v4"
- "Set up EAS Build"
- "Expo Router navigation setup"
- "Share code between Next.js and Expo"
- "OTA update configuration"
- "Build and submit to App Store / Play Store"

## Skill Chain

**Feeds into**: `motion-interaction-architect` (Reanimated v4 worklets are the mobile equivalent of Framer Motion — port animation tokens across) → `design-token-system-architect` (shared token system between Next.js web and Expo mobile) → `testing-strategy-architect` (Expo has specific testing patterns for New Architecture components).

**Creative combination**: `react-native-expo-architect` sets up the Expo foundation, `design-token-system-architect` generates a shared token package used by both the web (`tailwind.config.ts`) and mobile (`StyleSheet` constants), `motion-interaction-architect` provides the Reanimated animation system. One design language, two platforms.
