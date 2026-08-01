import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PartySettingsProvider } from "../src/usePartySettings";
import { DeviceProvider } from "../src/useDeviceSession";
import { SelectedCompanyProvider } from "../src/useSelectedCompany";
import "../src/locationTask"; // register background location ping task
import "../src/geoFenceTask"; // register shop geo-fence task

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DeviceProvider>
        <PartySettingsProvider>
          <SelectedCompanyProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SelectedCompanyProvider>
        </PartySettingsProvider>
      </DeviceProvider>
    </SafeAreaProvider>
  );
}
