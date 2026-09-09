import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PartySettingsProvider } from "../src/usePartySettings";
import { DeviceProvider } from "../src/useDeviceSession";
import { SelectedCompanyProvider } from "../src/useSelectedCompany";
import { ErrorBoundary } from "../src/ErrorBoundary";
import "../src/locationTask"; // register background location ping task
import "../src/geoFenceTask"; // register shop geo-fence task

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
              <Stack screenOptions={{ headerShown: false }} />
            </ErrorBoundary>
          </SelectedCompanyProvider>
        </PartySettingsProvider>
      </DeviceProvider>
    </SafeAreaProvider>
  );
}
