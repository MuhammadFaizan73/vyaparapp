import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, usePathname } from "expo-router";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PartySettingsProvider } from "../src/usePartySettings";
import { DeviceProvider } from "../src/useDeviceSession";
import { SelectedCompanyProvider } from "../src/useSelectedCompany";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { PersistentBottomBar } from "../src/components/PersistentBottomBar";
import "../src/locationTask"; // register background location ping task
import "../src/geoFenceTask"; // register shop geo-fence task

// Every list/view screen (Purchase List, Sale List, Payment-In, party/item detail,
// reports, ...) is its own top-level Stack route outside the (tabs) group, so the bottom
// nav bar — previously only ever rendered via (tabs)/_layout.tsx's Tabs `tabBar` prop —
// vanished the moment a user navigated to any of them. Render it here instead, as a
// plain flex sibling below the Stack (not absolutely positioned — this lets the Stack's
// own flex:1 area naturally shrink to make room, so every screen's own FAB/footer,
// already positioned off that same area's safe-area insets, ends up sitting just above
// the bar with no per-screen changes needed) — shown on every route except: the actual
// (tabs) screens (Home/Dashboard/Items/Menu/Premium already get their own bar from the
// Tabs navigator), every create/edit form (consistently named ".../new" throughout this
// app), and pre-login/full-screen-flow routes where a bottom nav makes no sense.
const TAB_PATHS = new Set(["/", "/dashboard", "/items", "/menu", "/premium"]);
const HIDDEN_BAR_PREFIXES = [
  "/onboarding", "/login", "/office-location", "/location-picker", "/accept-invite",
];
function shouldShowBottomBar(pathname: string): boolean {
  if (TAB_PATHS.has(pathname)) return false;
  if (pathname.endsWith("/new")) return false;
  if (HIDDEN_BAR_PREFIXES.some((p) => pathname.startsWith(p) || pathname.includes(p))) return false;
  return true;
}

export default function RootLayout() {
  // Known Android/old-architecture bug (facebook/react-native#25481, #23629): a Text's width
  // is measured against the WRONG/fallback font metrics if the intended font isn't registered
  // natively yet at that first layout pass — with numberOfLines + flexShrink siblings, that
  // measures too narrow and truncates to a sliver of characters. Ionicons' own component
  // reloads its font internally on mount, but that only re-renders the icon itself, not
  // necessarily re-measuring sibling Text nodes in the same row — only some LATER unrelated
  // re-render (of the whole screen) forced a fresh Yoga measurement pass that fixed it.
  // Loading the font explicitly before anything mounts removes the race entirely.
  const [iconsReady, setIconsReady] = useState(false);
  useEffect(() => {
    Ionicons.loadFont().catch(() => {}).finally(() => setIconsReady(true));
  }, []);

  // The native config (EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS, LAUNCH_WAIT_MS=0) checks for and
  // downloads an OTA update in the background on launch, but only ever RUNS it on the launch
  // after that — a user has to fully close and reopen the app twice to actually see a pushed
  // update. Check + fetch + reload explicitly at startup instead, so one relaunch is enough.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Offline or check failed — app just runs on whatever's already installed.
      }
    })();
  }, []);

  // Local bundled font — this resolves in a handful of milliseconds, not worth a splash
  // screen dependency just to cover it; a blank frame here is far cheaper than the bug it
  // eliminates (icon-adjacent Text mis-measured to a sliver of characters on first render).
  if (!iconsReady) return null;

  return (
    <SafeAreaProvider>
      <DeviceProvider>
        <PartySettingsProvider>
          <SelectedCompanyProvider>
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </SelectedCompanyProvider>
        </PartySettingsProvider>
      </DeviceProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const pathname = usePathname();
  const showBottomBar = shouldShowBottomBar(pathname);
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {showBottomBar && <PersistentBottomBar />}
    </View>
  );
}
