import { Platform } from "react-native";

export function getAuthRedirectUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  if (configuredUrl) return configuredUrl;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }

  return "unimatch://auth/callback";
}

export function isAuthCallbackUrl(url: string) {
  return url.includes("/auth/callback") || url.startsWith("unimatch://auth/callback");
}
