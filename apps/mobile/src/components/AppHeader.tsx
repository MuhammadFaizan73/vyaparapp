import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  teal?: boolean;
};

export function AppHeader({ title, onBack, right, teal }: Props) {
  const insets = useSafeAreaInsets();
  const bg = teal ? colors.tealDark : colors.card;
  const textColor = teal ? "#fff" : colors.text;
  const iconColor = teal ? "#fff" : colors.textMuted;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4, backgroundColor: bg }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8}>
            <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <View style={styles.rightSlot}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 22,
    fontWeight: "400",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  rightSlot: {
    width: 60,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
});
