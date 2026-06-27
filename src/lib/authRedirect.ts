import { Platform } from "react-native";

export function getAuthRedirectUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  if (configuredUrl) return configuredUrl;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth-callback.html`;
  }

  return "http://localhost:8081/auth-callback.html";
}

export function getPasswordResetRedirectUrl() {
  return getAuthRedirectUrl().replace("auth-callback.html", "reset-password.html");
}

export function isAuthCallbackUrl(url: string) {
  return url.includes("/auth/callback")
    || url.includes("/auth-callback.html")
    || url.startsWith("unimatch://auth/callback");
}
