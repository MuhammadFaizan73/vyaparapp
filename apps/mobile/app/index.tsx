import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vyapar Pakistan</Text>
      <Text style={styles.subtitle}>Mobile companion</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#475569" },
});
