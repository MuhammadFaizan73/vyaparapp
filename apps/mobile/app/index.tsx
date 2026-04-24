import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { loadToken, api } from "../src/auth";
import { colors } from "../src/theme";

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
          setState("app");
        }
      } catch {
        setState("onboarding");
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
