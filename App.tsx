import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
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
import { createVerificationRequest, saveProfile, signInWithEmail, signUpWithEmail } from "./src/lib/profileApi";
import { supabase } from "./src/lib/supabase";
import { GenderIdentity, ProfileDraft } from "./src/lib/types";

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
const institutionGroups = [
  {
    title: "Universities in Bern",
    options: ["University of Bern", "PHBern - University of Teacher Education"],
  },
  {
    title: "Universities of applied sciences",
    options: [
      "Bern University of Applied Sciences BFH",
      "BFH - Bern Academy of the Arts HKB",
      "BFH - School of Agricultural, Forest and Food Sciences HAFL",
      "BFH - Health Professions",
      "BFH - Business",
      "BFH - Social Work",
      "BFH - Engineering and Computer Science",
      "BFH - Architecture, Wood and Civil Engineering",
    ],
  },
  {
    title: "Higher technical schools in Bern",
    options: [
      "medi - Center for Medical Education Bern",
      "gibb Higher Technical School Bern",
      "TEKO Swiss Technical College Bern",
      "sfb Higher Technical School Bern",
      "Feusi Higher Technical School Bern",
      "WKS KV Bildung Bern",
      "BFF Bern Higher Technical School",
      "Hotelfachschule Thun",
    ],
  },
];

export default function App() {
  const [step, setStep] = useState<"auth" | "onboarding" | "app">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showInstitutions, setShowInstitutions] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({
    name: "",
    birthdate: "",
    gender: "non_binary",
    wantsToMeet: ["everyone"],
    photoUri: "",
    legiUri: "",
    university: "University of Bern",
    bio: "",
  });

  const canFinish = draft.name.trim() && draft.birthdate && draft.photoUri && draft.legiUri;

  async function authenticate(mode: "sign-in" | "sign-up") {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your private email and password first.");
      return;
    }

    setIsAuthenticating(true);
    const result = mode === "sign-in"
      ? await signInWithEmail(email.trim(), password)
      : await signUpWithEmail(email.trim(), password);
    setIsAuthenticating(false);

    if (result.error) {
      Alert.alert("Authentication failed", result.error.message);
      return;
    }

    setStep("onboarding");
  }

  async function chooseProfilePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) setDraft((current) => ({ ...current, photoUri: result.assets[0].uri }));
  }

  async function takeLegiPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera access needed", "Please allow camera access to photograph your Legi.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled) setDraft((current) => ({ ...current, legiUri: result.assets[0].uri }));
  }

  async function finishProfile() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      Alert.alert("Not signed in", "Please sign in again.");
      setStep("auth");
      return;
    }

    try {
      const verification = await createVerificationRequest(data.user.id, draft.legiUri);
      if (verification.error) throw verification.error;

      const result = await saveProfile(data.user.id, draft);
      if (result.error) throw result.error;

      setStep("app");
    } catch (error) {
      Alert.alert("Could not submit profile", error instanceof Error ? error.message : "Unknown error");
    }
  }

  function updateBirthdate(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean);
    setDraft({ ...draft, birthdate: parts.join("-") });
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
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.caption}>Use a private email for login. Student status is checked with a Legi photo in the next step.</Text>
            </View>

            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

            <Pressable style={[styles.cta, isAuthenticating && styles.disabled]} disabled={isAuthenticating} onPress={() => authenticate("sign-up")}>
              <Text style={styles.ctaText}>{isAuthenticating ? "Working..." : "Create account"}</Text>
            </Pressable>
            <Pressable style={styles.outline} onPress={() => authenticate("sign-in")}>
              <Text style={styles.outlineText}>Sign in</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === "onboarding" && (
          <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.navTitle}>Create profile</Text>
            <Pressable style={styles.photoBox} onPress={chooseProfilePhoto}>
              {draft.photoUri ? (
                <Image source={{ uri: draft.photoUri }} style={styles.photo} />
              ) : (
                <View>
                  <Text style={styles.title}>Add one profile photo</Text>
                  <Text style={styles.caption}>This is the only dating photo shown nearby.</Text>
                </View>
              )}
            </Pressable>

            <TextInput style={styles.input} placeholder="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              keyboardType="number-pad"
              value={draft.birthdate}
              onChangeText={updateBirthdate}
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
                  label={option.replace(/_/g, " ")}
                  onPress={() => setDraft({ ...draft, wantsToMeet: option === "everyone" ? ["everyone"] : [option] })}
                />
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.heading}>University / school</Text>
              <Pressable style={styles.select} onPress={() => setShowInstitutions(!showInstitutions)}>
                <Text style={styles.selectText}>{draft.university || "Choose an institution"}</Text>
                <Text style={styles.selectArrow}>{showInstitutions ? "Close" : "Choose"}</Text>
              </Pressable>
              {showInstitutions && (
                <View style={styles.optionPanel}>
                  {institutionGroups.map((group) => (
                    <View key={group.title} style={styles.optionGroup}>
                      <Text style={styles.optionGroupTitle}>{group.title}</Text>
                      {group.options.map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.optionRow, draft.university === option && styles.optionRowSelected]}
                          onPress={() => {
                            setDraft({ ...draft, university: option });
                            setShowInstitutions(false);
                          }}
                        >
                          <Text style={[styles.optionText, draft.university === option && styles.optionTextSelected]}>{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
            <TextInput style={styles.input} placeholder="Faculty / degree" value={draft.degree} onChangeText={(degree) => setDraft({ ...draft, degree })} />
            <TextInput style={[styles.input, styles.bio]} placeholder="Bio" multiline value={draft.bio} onChangeText={(bio) => setDraft({ ...draft, bio })} />

            <View style={styles.notice}>
              <Text style={styles.heading}>Legi review</Text>
              <Text style={styles.caption}>
                Your Legi photo must show a face photo, birthdate, first and last name, faculty, and an 8-digit student number like 21-114-004.
              </Text>
            </View>
            <Pressable style={styles.photoBox} onPress={takeLegiPhoto}>
              {draft.legiUri ? (
                <Image source={{ uri: draft.legiUri }} style={styles.photo} />
              ) : (
                <View>
                  <Text style={styles.title}>Photograph your Legi</Text>
                  <Text style={styles.caption}>Used only for student verification.</Text>
                </View>
              )}
            </Pressable>

            <Pressable style={[styles.cta, !canFinish && styles.disabled]} disabled={!canFinish} onPress={finishProfile}>
              <Text style={styles.ctaText}>Submit for review</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === "app" && (
          <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.navTitle}>Review pending</Text>
            <View style={styles.notice}>
              <Text style={styles.heading}>Profile submitted</Text>
              <Text style={styles.caption}>
                Your Legi is waiting for a short review. Once the visible criteria are confirmed, your account can be provisionally enabled.
              </Text>
            </View>
            <Pressable style={styles.outline} onPress={() => setStep("onboarding")}>
              <Text style={styles.outlineText}>Edit submission</Text>
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
  select: { backgroundColor: theme.surface, borderRadius: theme.radius, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  selectText: { flex: 1, fontSize: 16, color: theme.text },
  selectArrow: { fontSize: 13, fontWeight: "500", color: theme.accent },
  optionPanel: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: theme.radius, overflow: "hidden" },
  optionGroup: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  optionGroupTitle: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6, fontSize: 12, fontWeight: "500", color: theme.muted },
  optionRow: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  optionRowSelected: { backgroundColor: theme.tagBg },
  optionText: { fontSize: 14, color: theme.text },
  optionTextSelected: { color: theme.tagText, fontWeight: "500" },
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
