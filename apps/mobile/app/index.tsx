import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { loadToken, api } from "../src/auth";
import { colors } from "../src/theme";
import { scheduleExpiryNotifications, showExpiryBannerIfNeeded } from "../src/licenseNotifications";

type State = "loading" | "onboarding" | "license-gate" | "app";

export default function Root() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) { setState("onboarding"); return; }
      try {
        const status = await api.getLicenseStatus("mobile");
        if (status.state === "trial_expired" || status.state === "license_expired") {
          setState("license-gate");
        } else {
          // Schedule / show expiry notifications
          scheduleExpiryNotifications(status).catch(() => {});
          showExpiryBannerIfNeeded(status).catch(() => {});
          setState("app");
        }
      } catch (err: any) {
        // A token already exists at this point (the no-token case returned above), so
        // this call failing doesn't mean "not logged in" — it can just as easily be a
        // network blip or a slow Railway cold start. Only a genuine 401 means the token
        // itself is dead; anything else was wiping a perfectly valid session back to the
        // phone-entry screen, which read as "having to log in again and again" for no
        // reason. Fail open into the app for any other error.
        if (err?.response?.status === 401) {
          setState("onboarding");
        } else {
          setState("app");
        }
      }
    })();
  }, []);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (state === "onboarding") return <Redirect href="/onboarding" />;
  if (state === "license-gate") return <Redirect href="/license-gate" />;
  return <Redirect href="/(tabs)" />;
}
