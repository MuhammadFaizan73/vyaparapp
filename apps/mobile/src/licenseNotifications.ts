import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { LicenseStatus } from "@vyapar/api-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleExpiryNotifications(status: LicenseStatus): Promise<void> {
  const granted = await requestPermission();
  if (!granted) return;

  // Cancel any previously scheduled expiry notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === "license_expiry") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (status.state !== "trial" && status.state !== "licensed") return;

  const expiryDate = new Date(
    status.state === "licensed" && status.license?.expiresAt
      ? status.license.expiresAt
      : status.trialExpiresAt,
  );

  const thresholds = [7, 3, 1];
  for (const days of thresholds) {
    const triggerDate = new Date(expiryDate.getTime() - days * 24 * 60 * 60 * 1000);
    if (triggerDate > new Date()) {
      const label = status.state === "trial" ? "free trial" : "license";
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ ${days} day${days > 1 ? "s" : ""} left on your ${label}`,
          body:
            days === 1
              ? "Your subscription expires tomorrow. Renew now to keep access."
              : `Your ${label} expires in ${days} days. Don't lose your data access.`,
          data: { type: "license_expiry" },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    }
  }
}

export async function showExpiryBannerIfNeeded(status: LicenseStatus): Promise<void> {
  if (status.state !== "trial") return;
  if (status.daysRemaining > 3) return;

  const granted = await requestPermission();
  if (!granted) return;

  const days = status.daysRemaining;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: days === 0 ? "Trial Expired" : `Trial ends in ${days} day${days !== 1 ? "s" : ""}`,
      body:
        days === 0
          ? "Activate a license key to continue using Godigi."
          : `You have ${days} day${days !== 1 ? "s" : ""} left. Activate a license to keep access.`,
      data: { type: "license_expiry" },
    },
    trigger: null, // immediate
  });
}
