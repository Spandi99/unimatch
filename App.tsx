import { makeRedirectUri } from "expo-auth-session";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "./src/components/Theme";
import { createVerificationRequest, saveProfile } from "./src/lib/profileApi";
import { supabase } from "./src/lib/supabase";
import { GenderIdentity, ProfileDraft } from "./src/lib/types";

WebBrowser.maybeCompleteAuthSession();

const genderOptions: Array<{ label: string; value: GenderIdentity }> = [
  { label: "Woman", value: "woman" },
  { label: "Man", value: "man" },
  { label: "Non-binary", value: "non_binary" },
  { label: "Genderqueer", value: "genderqueer" },
  { label: "Agender", value: "agender" },
  { label: "Trans woman", value: "trans_woman" },
  { label: "Trans man", value: "trans_man" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

const meetOptions = ["women", "men", "non_binary_people", "everyone"];

export default function App() {
  const [step, setStep] = useState<"auth" | "onboarding" | "app">("auth");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({
    name: "",
    birthdate: "",
    gender: "non_binary",
    wantsToMeet: ["everyone"],
    photoUri: "",
    university: "ETH Zurich",
    bio: "",
  });

  const canFinish = draft.name.trim() && draft.birthdate && draft.photoUri;

  async function signInWithSwitchEduId() {
    const provider = process.env.EXPO_PUBLIC_SUPABASE_SWITCH_EDU_ID_PROVIDER;
    if (!provider) {
      Alert.alert(
        "SWITCH edu-ID is not configured yet",
        "Add EXPO_PUBLIC_SUPABASE_SWITCH_EDU_ID_PROVIDER to .env after creating the SWITCH edu-ID custom OIDC provider in Supabase.",
      );
      return;
    }

    setIsSigningIn(true);
    const redirectTo = makeRedirectUri({ scheme: "unimatch", path: "auth/callback" });

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as `custom:${string}`,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("Supabase did not return a SWITCH edu-ID login URL.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return;

      const callbackUrl = new URL(result.url);
      const code = callbackUrl.searchParams.get("code");
      if (!code) throw new Error("No login code was returned by SWITCH edu-ID.");

      const sessionResult = await supabase.auth.exchangeCodeForSession(code);
      if (sessionResult.error) throw sessionResult.error;

      setStep("onboarding");
    } catch (error) {
      Alert.alert("SWITCH edu-ID login failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) setDraft((current) => ({ ...current, photoUri: result.assets[0].uri }));
  }

  async function finishProfile() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      Alert.alert("Not signed in", "Please sign in again.");
      setStep("auth");
      return;
    }

    try {
      await createVerificationRequest(data.user.id, "switch_edu_id");
      const result = await saveProfile(data.user.id, draft);
      if (result.error) throw result.error;
      setStep("app");
    } catch (error) {
      Alert.alert("Could not save profile", error instanceof Error ? error.message : "Unknown error");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {step === "auth" && (
          <ScrollView contentContainerStyle={styles.centerScreen}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandIconText}>U</Text>
              </View>
              <Text style={styles.brand}>UniMatch</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.title}>Verify your student status</Text>
              <Text style={styles.caption}>Use SWITCH edu-ID before creating a UniMatch profile.</Text>
            </View>

            <View style={styles.notice}>
              <Text style={styles.heading}>Browser login required</Text>
              <Text style={styles.caption}>
                UniMatch opens the secure SWITCH edu-ID login in the system browser. Registration starts only after a valid student login.
              </Text>
            </View>

            <Pressable style={[styles.cta, isSigningIn && styles.disabled]} disabled={isSigningIn} onPress={signInWithSwitchEduId}>
              <Text style={styles.ctaText}>{isSigningIn ? "Opening SWITCH edu-ID..." : "Continue with SWITCH edu-ID"}</Text>
            </Pressable>
            <Pressable
              style={styles.outline}
              onPress={() => Alert.alert("Legi review", "Legi review can be added as a manual fallback, but real account login now starts with SWITCH edu-ID.")}
            >
              <Text style={styles.outlineText}>I only have a student Legi</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === "onboarding" && (
          <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.navTitle}>Create profile</Text>
            <Pressable style={styles.photoBox} onPress={choosePhoto}>
              {draft.photoUri ? (
                <Image source={{ uri: draft.photoUri }} style={styles.photo} />
              ) : (
                <View>
                  <Text style={styles.title}>Add one profile photo</Text>
                  <Text style={styles.caption}>This is the only photo people see nearby.</Text>
                </View>
              )}
            </Pressable>

            <TextInput style={styles.input} placeholder="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
            <TextInput
              style={styles.input}
              placeholder="Birthdate, e.g. 2002-04-18"
              value={draft.birthdate}
              onChangeText={(birthdate) => setDraft({ ...draft, birthdate })}
            />

            <Text style={styles.heading}>Gender</Text>
            <View style={styles.chips}>
              {genderOptions.map((item) => (
                <Chip
                  key={item.value}
                  selected={draft.gender === item.value}
                  label={item.label}
                  onPress={() => setDraft({ ...draft, gender: item.value })}
                />
              ))}
            </View>

            <Text style={styles.heading}>Who do you want to meet?</Text>
            <View style={styles.chips}>
              {meetOptions.map((option) => (
                <Chip
                  key={option}
                  selected={draft.wantsToMeet.includes(option)}
                  label={option.replaceAll("_", " ")}
                  onPress={() => setDraft({ ...draft, wantsToMeet: option === "everyone" ? ["everyone"] : [option] })}
                />
              ))}
            </View>

            <TextInput style={styles.input} placeholder="University" value={draft.university} onChangeText={(university) => setDraft({ ...draft, university })} />
            <TextInput style={styles.input} placeholder="Degree" value={draft.degree} onChangeText={(degree) => setDraft({ ...draft, degree })} />
            <TextInput style={[styles.input, styles.bio]} placeholder="Bio" multiline value={draft.bio} onChangeText={(bio) => setDraft({ ...draft, bio })} />

            <Pressable style={[styles.cta, !canFinish && styles.disabled]} disabled={!canFinish} onPress={finishProfile}>
              <Text style={styles.ctaText}>Start UniMatch</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === "app" && (
          <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.navTitle}>Nearby</Text>
            <View style={styles.notice}>
              <Text style={styles.heading}>Real backend connected</Text>
              <Text style={styles.caption}>
                SWITCH edu-ID login, profile data and photo upload now go through Supabase. Next we build Nearby, message requests and matches against the database.
              </Text>
            </View>
            <Pressable style={styles.outline} onPress={() => setStep("onboarding")}>
              <Text style={styles.outlineText}>Edit profile</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip(props: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, props.selected && styles.chipSelected]} onPress={props.onPress}>
      <Text style={[styles.chipText, props.selected && styles.chipTextSelected]}>{props.selected ? `Selected ${props.label}` : props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  centerScreen: { flexGrow: 1, justifyContent: "center", padding: theme.screenPadding, gap: 18 },
  screen: { padding: theme.screenPadding, gap: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  brandIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  brandIconText: { color: "#fff", fontWeight: "600" },
  brand: { fontSize: 22, fontWeight: "500" },
  section: { gap: 10 },
  navTitle: { textAlign: "center", fontSize: 16, fontWeight: "500", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "500", textAlign: "center" },
  heading: { fontSize: 16, fontWeight: "500" },
  caption: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  input: { backgroundColor: theme.surface, borderRadius: theme.radius, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  bio: { minHeight: 90, textAlignVertical: "top" },
  cta: { height: 48, borderRadius: theme.radius, backgroundColor: theme.text, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  outline: { height: 48, borderRadius: theme.radius, borderWidth: 1.5, borderColor: theme.text, alignItems: "center", justifyContent: "center" },
  outlineText: { color: theme.text, fontSize: 14, fontWeight: "500" },
  disabled: { opacity: 0.45 },
  photoBox: { height: 180, borderRadius: 16, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
  chipSelected: { backgroundColor: theme.tagBg, borderColor: theme.accent, borderWidth: 1.5 },
  chipText: { color: theme.muted, fontSize: 14, fontWeight: "500" },
  chipTextSelected: { color: theme.tagText },
  notice: { backgroundColor: theme.tagBg, borderRadius: theme.radius, padding: 14, gap: 8 },
});
