import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { loadToken } from "../src/auth";
import { colors } from "../src/theme";

export default function Root() {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    loadToken().then(setToken);
  }, []);

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
