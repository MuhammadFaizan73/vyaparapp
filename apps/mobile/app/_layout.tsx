import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PartySettingsProvider } from "../src/usePartySettings";
import { DeviceProvider } from "../src/useDeviceSession";
import { SelectedCompanyProvider } from "../src/useSelectedCompany";
import { ErrorBoundary } from "../src/ErrorBoundary";
import "../src/locationTask"; // register background location ping task
import "../src/geoFenceTask"; // register shop geo-fence task

export default function RootLayout() {
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
