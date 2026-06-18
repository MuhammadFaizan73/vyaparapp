import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PartySettingsProvider } from "../src/usePartySettings";
import { DeviceProvider } from "../src/useDeviceSession";
import "../src/locationTask"; // register background location ping task
import "../src/geoFenceTask"; // register shop geo-fence task

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DeviceProvider>
        <PartySettingsProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </PartySettingsProvider>
      </DeviceProvider>
    </SafeAreaProvider>
  );
}
