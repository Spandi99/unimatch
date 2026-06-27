import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { getAuthRedirectUrl, isAuthCallbackUrl } from "./src/lib/authRedirect";
import {
  VerificationReview,
  createVerificationRequest,
  getLatestVerificationReview,
  reviewVerificationAutomatically,
  saveProfile,
  signInWithEmail,
  signUpWithEmail,
} from "./src/lib/profileApi";
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
const demoProfiles = [
  { initials: "SK", name: "Sophie", age: 24, uni: "University of Bern", degree: "Medicine", distance: "~120m", place: "Unitobler library", bio: "Running, cooking, and cinema. Usually studying near the anatomy floor." },
  { initials: "NF", name: "Nina", age: 22, uni: "BFH", degree: "Design", distance: "~200m", place: "Bern main library", bio: "Illustration, yoga, and collecting too many houseplants." },
  { initials: "MR", name: "Marco", age: 26, uni: "University of Bern", degree: "Architecture", distance: "~350m", place: "Muesmatt campus", bio: "Photography, cycling, strong opinions about fonts." },
  { initials: "LB", name: "Lena", age: 23, uni: "PHBern", degree: "Education", distance: "~470m", place: "PHBern cafe", bio: "Reading too much, hiking when not reading." },
];
const appTabs = ["Nearby", "Discover", "Matches", "Profile"];
const rememberMeKey = "unimatch.rememberMe";
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
  const [step, setStep] = useState<"auth" | "auth-callback" | "onboarding" | "review" | "home">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isBooting, setIsBooting] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingReview, setIsRefreshingReview] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [callbackMessage, setCallbackMessage] = useState("Confirming your email...");
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [submitStage, setSubmitStage] = useState("");
  const [review, setReview] = useState<VerificationReview | null>(null);
  const [showInstitutions, setShowInstitutions] = useState(false);
  const [appTab, setAppTab] = useState(0);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [requestProfile, setRequestProfile] = useState<number | null>(null);
  const [requestDraft, setRequestDraft] = useState("");
  const [chatIndex, setChatIndex] = useState<number | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [incomingRequests, setIncomingRequests] = useState([
    { profile: demoProfiles[3], note: "I think we were both in the library earlier. Coffee after lectures?", time: "8m" },
    { profile: demoProfiles[0], note: "Your bio had me at mediocre pasta. Trade recipes?", time: "24m" },
  ]);
  const [matches, setMatches] = useState([
    { profile: demoProfiles[1], messages: [{ text: "Hey! How was your exam?", mine: false }], time: "2m" },
  ]);
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

  const canFinish = Boolean(draft.name.trim() && draft.birthdate && draft.photoUri && draft.legiUri);

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url || !isAuthCallbackUrl(url)) return;
      setStep("auth-callback");
      completeEmailConfirmation(url);
    }

    async function bootFromSession() {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && isAuthCallbackUrl(initialUrl)) {
        handleUrl(initialUrl);
        setIsBooting(false);
        return;
      }

      if (Platform.OS === "web" && typeof window !== "undefined" && isAuthCallbackUrl(window.location.href)) {
        handleUrl(window.location.href);
        setIsBooting(false);
        return;
      }

      const savedRememberMe = await AsyncStorage.getItem(rememberMeKey);
      if (savedRememberMe === "false") {
        setRememberMe(false);
        setIsBooting(false);
        return;
      }

      const session = (await supabase.auth.getSession()).data.session;
      if (session?.user) {
        await routeAfterAuthentication(session.user.id);
      }
      setIsBooting(false);
    }

    const urlListener = Linking.addEventListener("url", (event) => handleUrl(event.url));

    bootFromSession().catch((error) => {
      console.warn(error);
      setIsBooting(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      AsyncStorage.setItem(rememberMeKey, rememberMe ? "true" : "false").catch(console.warn);
      setPendingConfirmationEmail("");
      routeAfterAuthentication(session.user.id).catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown authentication error";
        setAuthMessage(message);
      });
    });

    return () => {
      urlListener.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function completeEmailConfirmation(url: string) {
    setCallbackMessage("Confirming your email...");
    try {
      const parsedUrl = new URL(url.replace("#", "?"));
      const code = parsedUrl.searchParams.get("code");
      const accessToken = parsedUrl.searchParams.get("access_token");
      const refreshToken = parsedUrl.searchParams.get("refresh_token");

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) throw result.error;
        if (result.data.session?.user) {
          await AsyncStorage.setItem(rememberMeKey, rememberMe ? "true" : "false");
          setCallbackMessage("Email confirmed. Taking you into UniMatch...");
          await routeAfterAuthentication(result.data.session.user.id);
          return;
        }
      }

      if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (result.error) throw result.error;
        if (result.data.session?.user) {
          await AsyncStorage.setItem(rememberMeKey, rememberMe ? "true" : "false");
          setCallbackMessage("Email confirmed. Taking you into UniMatch...");
          await routeAfterAuthentication(result.data.session.user.id);
          return;
        }
      }

      setCallbackMessage("Email confirmed. Go back to UniMatch and sign in with your email and password.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not confirm this email link.";
      setCallbackMessage(message);
      setAuthMessage(message);
    }
  }

  async function authenticate(mode: "sign-in" | "sign-up") {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your private email and password first.");
      return;
    }

    setAuthMessage("");
    setIsAuthenticating(true);
    try {
      const result = mode === "sign-in"
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password, getAuthRedirectUrl());

      if (result.error) {
        setAuthMessage(result.error.message);
        Alert.alert("Authentication failed", result.error.message);
        return;
      }

      const session = result.data.session ?? (await supabase.auth.getSession()).data.session;
      if (!session) {
        const message = mode === "sign-up"
          ? "Account created. Confirm the email we sent you, then tap Sign in."
          : "No active session yet. If you just created this account, confirm the email first.";
        setPendingConfirmationEmail(email.trim());
        setAuthMessage(message);
        Alert.alert("Confirm your email", message);
        return;
      }

      await AsyncStorage.setItem(rememberMeKey, rememberMe ? "true" : "false");
      setPendingConfirmationEmail("");
      setProfileMessage("");
      await routeAfterAuthentication(session.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown authentication error";
      setAuthMessage(message);
      Alert.alert("Authentication failed", message);
    } finally {
      setIsAuthenticating(false);
    }
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

  async function routeAfterAuthentication(userId: string) {
    const profile = await supabase
      .from("profiles")
      .select("name, birthdate, gender, wants_to_meet, university, degree, bio, photo_path")
      .eq("id", userId)
      .maybeSingle();

    if (profile.error) throw profile.error;

    const profileData = profile.data;
    if (profileData) {
      setDraft((current) => ({
        ...current,
        name: profileData.name ?? "",
        birthdate: profileData.birthdate ?? "",
        gender: profileData.gender ?? current.gender,
        wantsToMeet: profileData.wants_to_meet ?? current.wantsToMeet,
        university: profileData.university ?? current.university,
        degree: profileData.degree ?? "",
        bio: profileData.bio ?? "",
        photoUri: current.photoUri,
      }));

      const latestReview = await refreshReview(userId);
      if (latestReview?.status === "verified") {
        setShowVerifiedBanner(false);
        setStep("home");
        return;
      }
      if (latestReview) {
        setStep("review");
        return;
      }
    }

    setStep("onboarding");
  }

  async function finishProfile() {
    setProfileMessage("");
    setSubmitStage("Checking your session...");
    setIsSubmitting(true);
    try {
      let { data } = await supabase.auth.getUser();

      if (!data.user && email.trim() && password) {
        const signInResult = await signInWithEmail(email.trim(), password);
        if (signInResult.error) throw signInResult.error;
        data = (await supabase.auth.getUser()).data;
      }

      if (!data.user) {
        throw new Error("You are not signed in. Please sign in again before submitting your Legi review.");
      }

      setSubmitStage("Saving your profile...");
      const result = await saveProfile(data.user.id, draft);
      if (result.error) throw result.error;

      setSubmitStage("Uploading your Legi...");
      const verification = await createVerificationRequest(data.user.id, draft.legiUri);
      if (verification.error) throw verification.error;

      const verificationRequestId = verification.data?.id;
      if (!verificationRequestId) throw new Error("Legi review request was created without an id.");

      setSubmitStage("OCR is checking the Legi criteria...");
      await reviewVerificationAutomatically(verificationRequestId);

      setSubmitStage("Loading review result...");
      const latestReview = await refreshReview(data.user.id);
      if (latestReview?.status === "verified") setShowVerifiedBanner(true);
      setStep(latestReview?.status === "verified" ? "home" : "review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setProfileMessage(message);
      Alert.alert("Could not submit profile", message);
    } finally {
      setIsSubmitting(false);
      setSubmitStage("");
    }
  }

  function updateBirthdate(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean);
    setDraft({ ...draft, birthdate: parts.join("-") });
  }

  async function refreshReview(userId?: string) {
    setReviewMessage("");
    setIsRefreshingReview(true);
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const { data } = await supabase.auth.getUser();
        currentUserId = data.user?.id;
      }

      if (!currentUserId) throw new Error("You are not signed in.");

      const latestReview = await getLatestVerificationReview(currentUserId);
      setReview(latestReview);
      if (!latestReview) setReviewMessage("No Legi review request found yet.");
      return latestReview;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown review error";
      setReviewMessage(message);
      Alert.alert("Could not refresh review", message);
      return null;
    } finally {
      setIsRefreshingReview(false);
    }
  }

  async function saveProfileBasics() {
    setProfileSaveMessage("");
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setProfileSaveMessage("Please sign in again.");
      return;
    }

    const result = await supabase
      .from("profiles")
      .update({
        name: draft.name,
        birthdate: draft.birthdate,
        gender: draft.gender,
        wants_to_meet: draft.wantsToMeet,
        university: draft.university ?? null,
        degree: draft.degree ?? null,
        bio: draft.bio ?? "",
      })
      .eq("id", data.user.id);

    if (result.error) {
      setProfileSaveMessage(result.error.message);
      return;
    }

    setIsEditingProfile(false);
    setProfileSaveMessage("Profile saved.");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {isBooting && (
          <View style={styles.centerScreen}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandIconText}>U</Text>
              </View>
              <Text style={styles.brand}>UniMatch</Text>
            </View>
            <Text style={styles.caption}>Checking your session...</Text>
          </View>
        )}
        {!isBooting && step === "auth" && (
          <ScrollView contentContainerStyle={styles.centerScreen}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandIconText}>U</Text>
              </View>
              <Text style={styles.brand}>UniMatch</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.title}>{pendingConfirmationEmail ? "Confirm your email" : "Create your account"}</Text>
              <Text style={styles.caption}>
                {pendingConfirmationEmail
                  ? `We sent a confirmation link to ${pendingConfirmationEmail}. Open it, then come back and sign in.`
                  : "Use a private email for login. Student status is checked with a Legi photo in the next step."}
              </Text>
            </View>

            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
            <Pressable style={styles.checkRow} onPress={() => setRememberMe((value) => !value)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                <Text style={styles.checkboxText}>{rememberMe ? "✓" : ""}</Text>
              </View>
              <Text style={styles.checkLabel}>Stay signed in on this device</Text>
            </Pressable>

            <Pressable style={[styles.cta, isAuthenticating && styles.disabled]} disabled={isAuthenticating} onPress={() => authenticate("sign-up")}>
              <Text style={styles.ctaText}>{isAuthenticating ? "Working..." : "Create account"}</Text>
            </Pressable>
            <Pressable style={[styles.outline, isAuthenticating && styles.disabled]} disabled={isAuthenticating} onPress={() => authenticate("sign-in")}>
              <Text style={styles.outlineText}>{pendingConfirmationEmail ? "I confirmed it - sign in" : "Sign in"}</Text>
            </Pressable>
            {authMessage ? <Text style={styles.errorText}>{authMessage}</Text> : null}
          </ScrollView>
        )}

        {!isBooting && step === "auth-callback" && (
          <View style={styles.centerScreen}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandIconText}>U</Text>
              </View>
              <Text style={styles.brand}>UniMatch</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.title}>Email confirmation</Text>
              <Text style={styles.caption}>{callbackMessage}</Text>
            </View>
            <Pressable style={styles.cta} onPress={() => setStep("auth")}>
              <Text style={styles.ctaText}>Back to sign in</Text>
            </Pressable>
          </View>
        )}

        {!isBooting && step === "onboarding" && (
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

            {profileMessage ? <Text style={styles.errorText}>{profileMessage}</Text> : null}
            {submitStage ? <Text style={styles.progressText}>{submitStage}</Text> : null}
            <Pressable style={[styles.cta, (!canFinish || isSubmitting) && styles.disabled]} disabled={!canFinish || isSubmitting} onPress={finishProfile}>
              <Text style={styles.ctaText}>{isSubmitting ? "Submitting..." : "Submit for review"}</Text>
            </Pressable>
          </ScrollView>
        )}

        {!isBooting && step === "review" && (
          <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.navTitle}>{review?.status === "verified" ? "Review verified" : review?.status === "rejected" ? "Review rejected" : "Review pending"}</Text>
            <View style={styles.notice}>
              <Text style={styles.heading}>Profile submitted</Text>
              <Text style={styles.caption}>
                Your Legi has been uploaded. The visible criteria are checked by a reviewer; this app now shows the saved review status from Supabase.
              </Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.heading}>Review status</Text>
              <Text style={styles.statusText}>{review?.status ?? "pending"}</Text>
              <ReviewRow label="Face photo visible" value={review?.checks?.has_face_photo} />
              <ReviewRow label="Birthdate visible" value={review?.checks?.has_birthdate} />
              <ReviewRow label="First and last name visible" value={review?.checks?.has_first_and_last_name} />
              <ReviewRow label="Faculty visible" value={review?.checks?.has_faculty} />
              <ReviewRow label="Student number format valid" value={review?.checks?.has_student_number} />
              {review?.checks?.student_number ? <Text style={styles.caption}>Student number: {review.checks.student_number}</Text> : null}
              {review?.checks?.reviewer_notes ? <Text style={styles.caption}>Notes: {review.checks.reviewer_notes}</Text> : null}
            </View>
            {reviewMessage ? <Text style={styles.errorText}>{reviewMessage}</Text> : null}
            <Pressable style={[styles.outline, isRefreshingReview && styles.disabled]} disabled={isRefreshingReview} onPress={() => refreshReview()}>
              <Text style={styles.outlineText}>{isRefreshingReview ? "Refreshing..." : "Refresh status"}</Text>
            </Pressable>
            {review?.status === "verified" && (
              <Pressable style={styles.cta} onPress={() => setStep("home")}>
                <Text style={styles.ctaText}>Enter UniMatch</Text>
              </Pressable>
            )}
            <Pressable style={styles.outline} onPress={() => setStep("onboarding")}>
              <Text style={styles.outlineText}>Edit submission</Text>
            </Pressable>
          </ScrollView>
        )}

        {!isBooting && step === "home" && (
          <View style={styles.flex}>
            {chatIndex !== null ? (
              <ChatScreen
                match={matches[chatIndex]}
                onBack={() => setChatIndex(null)}
                onSend={(text) => {
                  setMatches((current) => current.map((match, index) => index === chatIndex ? { ...match, messages: [...match.messages, { text, mine: true }] } : match));
                }}
              />
            ) : requestProfile !== null ? (
              <RequestComposer
                profile={demoProfiles[requestProfile]}
                draft={requestDraft}
                onDraft={setRequestDraft}
                onBack={() => setRequestProfile(null)}
                onSend={() => {
                  if (!requestDraft.trim()) {
                    Alert.alert("Missing note", "Write a short request first.");
                    return;
                  }
                  Alert.alert("Request sent", "The chat opens only if they accept.");
                  setRequestProfile(null);
                  setSelectedProfile(null);
                  setRequestDraft("");
                  setAppTab(2);
                }}
              />
            ) : selectedProfile !== null ? (
              <ProfileDetail
                profile={demoProfiles[selectedProfile]}
                onBack={() => setSelectedProfile(null)}
                onRequest={() => {
                  setRequestProfile(selectedProfile);
                  setRequestDraft("");
                }}
              />
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.screenWithTabs}>
                  <Text style={styles.navTitle}>{appTabs[appTab]}</Text>
                  {showVerifiedBanner && (
                    <View style={styles.successBanner}>
                      <View style={styles.profileCopy}>
                        <Text style={styles.heading}>You are verified</Text>
                        <Text style={styles.caption}>Your profile is active now.</Text>
                      </View>
                      <Pressable onPress={() => setShowVerifiedBanner(false)}>
                        <Text style={styles.dismissText}>OK</Text>
                      </Pressable>
                    </View>
                  )}
                  {appTab === 0 && (
                    <>
                      <View style={styles.homeHeader}>
                        <View>
                          <Text style={styles.titleLeft}>Nearby now</Text>
                          <Text style={styles.caption}>Visible at enabled hotspots.</Text>
                        </View>
                        <View style={styles.livePill}>
                          <Text style={styles.livePillText}>Visible</Text>
                        </View>
                      </View>
                      {demoProfiles.map((profile, index) => (
                        <Pressable key={profile.name} style={styles.profileRow} onPress={() => setSelectedProfile(index)}>
                          <View style={styles.avatar}><Text style={styles.avatarText}>{profile.initials}</Text></View>
                          <View style={styles.profileCopy}>
                            <Text style={styles.profileName}>{profile.name}, {profile.age}</Text>
                            <Text style={styles.caption}>{profile.place} - {profile.distance}</Text>
                            <Text style={styles.caption}>{profile.degree}</Text>
                          </View>
                          <Text style={styles.chevron}>Next</Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                  {appTab === 1 && (
                    <>
                      <View style={styles.discoverCard}>
                        <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{demoProfiles[2].initials}</Text></View>
                        <Text style={styles.title}>{demoProfiles[2].name}, {demoProfiles[2].age}</Text>
                        <Text style={styles.caption}>{demoProfiles[2].uni} - {demoProfiles[2].degree}</Text>
                        <Text style={styles.caption}>{demoProfiles[2].bio}</Text>
                      </View>
                      <View style={styles.actionRow}>
                        <Pressable style={styles.outlineSmall}><Text style={styles.outlineText}>Pass</Text></Pressable>
                        <Pressable
                          style={styles.ctaSmall}
                          onPress={() => {
                            setRequestProfile(2);
                            setRequestDraft("");
                          }}
                        >
                          <Text style={styles.ctaText}>Request</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                  {appTab === 2 && (
                    <>
                      <Text style={styles.heading}>Message requests</Text>
                      {incomingRequests.map((request, index) => (
                        <View key={`${request.profile.name}-${request.time}`} style={styles.requestCard}>
                          <Text style={styles.profileName}>{request.profile.name}</Text>
                          <Text style={styles.caption}>{request.note}</Text>
                          <View style={styles.actionRow}>
                            <Pressable style={styles.outlineSmall} onPress={() => setIncomingRequests((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                              <Text style={styles.outlineText}>Decline</Text>
                            </Pressable>
                            <Pressable
                              style={styles.ctaSmall}
                              onPress={() => {
                                setMatches((current) => [{ profile: request.profile, messages: [{ text: request.note, mine: false }], time: "now" }, ...current]);
                                setIncomingRequests((current) => current.filter((_, itemIndex) => itemIndex !== index));
                                setChatIndex(0);
                              }}
                            >
                              <Text style={styles.ctaText}>Accept</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      <Text style={styles.heading}>Chats</Text>
                      {matches.map((match, index) => (
                        <Pressable key={match.profile.name} style={styles.profileRow} onPress={() => setChatIndex(index)}>
                          <View style={styles.avatar}><Text style={styles.avatarText}>{match.profile.initials}</Text></View>
                          <View style={styles.profileCopy}>
                            <Text style={styles.profileName}>{match.profile.name}</Text>
                            <Text style={styles.caption}>{match.messages[match.messages.length - 1]?.text}</Text>
                          </View>
                          <Text style={styles.caption}>{match.time}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                  {appTab === 3 && (
                    <>
                      <ProfileTab
                        draft={draft}
                        isEditing={isEditingProfile}
                        message={profileSaveMessage}
                        onEdit={() => {
                          setProfileSaveMessage("");
                          setIsEditingProfile(true);
                        }}
                        onCancel={() => {
                          setProfileSaveMessage("");
                          setIsEditingProfile(false);
                        }}
                        onSave={saveProfileBasics}
                        onDraftChange={(nextDraft) => setDraft((current) => ({ ...current, ...nextDraft }))}
                      />
                    </>
                  )}
                </ScrollView>
                <View style={styles.tabs}>
                  {appTabs.map((tab, index) => (
                    <Pressable key={tab} style={styles.tabButton} onPress={() => setAppTab(index)}>
                      <Text style={[styles.tabText, appTab === index && styles.tabTextActive]}>{tab}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
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

function ReviewRow(props: { label: string; value: boolean | null | undefined }) {
  const marker = props.value === true ? "Passed" : props.value === false ? "Missing" : "Waiting";
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{props.label}</Text>
      <Text style={[styles.reviewValue, props.value === true && styles.reviewPassed, props.value === false && styles.reviewFailed]}>{marker}</Text>
    </View>
  );
}

function ProfileDetail(props: { profile: typeof demoProfiles[number]; onBack: () => void; onRequest: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable style={styles.backButton} onPress={props.onBack}>
        <Text style={styles.backText}>Back to Nearby</Text>
      </Pressable>
      <View style={styles.discoverCard}>
        <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{props.profile.initials}</Text></View>
        <Text style={styles.title}>{props.profile.name}, {props.profile.age}</Text>
        <Text style={styles.caption}>{props.profile.uni} - {props.profile.degree}</Text>
        <Text style={styles.caption}>{props.profile.place} - {props.profile.distance}</Text>
        <Text style={styles.caption}>{props.profile.bio}</Text>
      </View>
      <Pressable style={styles.cta} onPress={props.onRequest}>
        <Text style={styles.ctaText}>Send message request</Text>
      </Pressable>
    </ScrollView>
  );
}

function RequestComposer(props: { profile: typeof demoProfiles[number]; draft: string; onDraft: (value: string) => void; onBack: () => void; onSend: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable style={styles.backButton} onPress={props.onBack}>
        <Text style={styles.backText}>Back to Profile</Text>
      </Pressable>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{props.profile.initials}</Text></View>
        <Text style={styles.titleLeft}>Message {props.profile.name}</Text>
        <Text style={styles.caption}>Write a short request. If they accept, the chat opens.</Text>
      </View>
      <TextInput
        style={[styles.input, styles.bio]}
        multiline
        maxLength={220}
        placeholder="Mention where you crossed paths or why you want to talk."
        value={props.draft}
        onChangeText={props.onDraft}
      />
      <Pressable style={styles.cta} onPress={props.onSend}>
        <Text style={styles.ctaText}>Send request</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChatScreen(props: { match: { profile: typeof demoProfiles[number]; messages: Array<{ text: string; mine: boolean }> }; onBack: () => void; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <View style={styles.flex}>
      <Pressable style={styles.chatTitle} onPress={props.onBack}>
        <Text style={styles.chatTitleText}>Back to Matches - {props.match.profile.name}</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.chatBody}>
        {props.match.messages.map((message, index) => (
          <View key={`${message.text}-${index}`} style={[styles.bubble, message.mine && styles.bubbleMine]}>
            <Text style={[styles.bubbleText, message.mine && styles.bubbleTextMine]}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputBar}>
        <TextInput style={styles.chatInput} placeholder="Message" value={draft} onChangeText={setDraft} />
        <Pressable
          style={styles.sendButton}
          onPress={() => {
            const text = draft.trim();
            if (!text) return;
            props.onSend(text);
            setDraft("");
          }}
        >
          <Text style={styles.ctaText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileTab(props: {
  draft: ProfileDraft;
  isEditing: boolean;
  message: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (draft: Partial<ProfileDraft>) => void;
}) {
  if (props.isEditing) {
    return (
      <>
        <View style={styles.profileHeader}>
          <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{props.draft.name ? props.draft.name.slice(0, 2).toUpperCase() : "U"}</Text></View>
          <Text style={styles.title}>Edit profile</Text>
        </View>
        <TextInput style={styles.input} placeholder="Name" value={props.draft.name} onChangeText={(name) => props.onDraftChange({ name })} />
        <TextInput style={styles.input} placeholder="Faculty / degree" value={props.draft.degree} onChangeText={(degree) => props.onDraftChange({ degree })} />
        <TextInput style={[styles.input, styles.bio]} placeholder="Bio" multiline value={props.draft.bio} onChangeText={(bio) => props.onDraftChange({ bio })} />
        {props.message ? <Text style={props.message === "Profile saved." ? styles.progressText : styles.errorText}>{props.message}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable style={styles.outlineSmall} onPress={props.onCancel}>
            <Text style={styles.outlineText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.ctaSmall} onPress={props.onSave}>
            <Text style={styles.ctaText}>Save</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.profileHeader}>
        <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{props.draft.name ? props.draft.name.slice(0, 2).toUpperCase() : "U"}</Text></View>
        <Text style={styles.title}>{props.draft.name || "Your profile"}</Text>
        <Text style={styles.caption}>{props.draft.university} - {props.draft.degree || "Student"}</Text>
      </View>
      <View style={styles.reviewCard}>
        <Text style={styles.heading}>About</Text>
        <Text style={styles.caption}>{props.draft.bio || "No bio yet."}</Text>
        <Text style={styles.caption}>Looking to meet: {props.draft.wantsToMeet.join(", ").replace(/_/g, " ")}</Text>
      </View>
      {props.message ? <Text style={styles.progressText}>{props.message}</Text> : null}
      <Pressable style={styles.outline} onPress={props.onEdit}>
        <Text style={styles.outlineText}>Edit profile</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  centerScreen: { flexGrow: 1, justifyContent: "center", padding: theme.screenPadding, gap: 18 },
  screen: { padding: theme.screenPadding, gap: 14 },
  screenWithTabs: { padding: theme.screenPadding, paddingBottom: 92, gap: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  brandIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  brandIconText: { color: "#fff", fontWeight: "600" },
  brand: { fontSize: 22, fontWeight: "500" },
  section: { gap: 10 },
  navTitle: { textAlign: "center", fontSize: 16, fontWeight: "500", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "500", textAlign: "center" },
  titleLeft: { fontSize: 18, fontWeight: "500" },
  heading: { fontSize: 16, fontWeight: "500" },
  caption: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  errorText: { color: "#b42318", fontSize: 13, lineHeight: 18, textAlign: "center" },
  progressText: { color: theme.muted, fontSize: 13, lineHeight: 18, textAlign: "center" },
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.separator, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxChecked: { backgroundColor: theme.text, borderColor: theme.text },
  checkboxText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkLabel: { color: theme.text, fontSize: 14 },
  disabled: { opacity: 0.45 },
  photoBox: { height: 180, borderRadius: 16, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
  chipSelected: { backgroundColor: theme.tagBg, borderColor: theme.accent, borderWidth: 1.5 },
  chipText: { color: theme.muted, fontSize: 14, fontWeight: "500" },
  chipTextSelected: { color: theme.tagText },
  notice: { backgroundColor: theme.tagBg, borderRadius: theme.radius, padding: 14, gap: 8 },
  reviewCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: theme.radius, padding: 14, gap: 10 },
  statusText: { alignSelf: "flex-start", backgroundColor: theme.tagBg, color: theme.tagText, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontSize: 13, fontWeight: "600" },
  reviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  reviewLabel: { flex: 1, color: theme.text, fontSize: 14 },
  reviewValue: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  reviewPassed: { color: "#067647" },
  reviewFailed: { color: "#b42318" },
  homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  livePill: { backgroundColor: "#ecfdf3", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  livePillText: { color: "#067647", fontSize: 12, fontWeight: "700" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: theme.radius, padding: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.tagText, fontSize: 20, fontWeight: "700" },
  profileCopy: { flex: 1, gap: 2 },
  profileName: { color: theme.text, fontSize: 16, fontWeight: "600" },
  requestButton: { borderRadius: 999, backgroundColor: theme.text, paddingHorizontal: 12, paddingVertical: 8 },
  requestButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  backButton: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  successBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "#ecfdf3", borderRadius: theme.radius, padding: 12 },
  dismissText: { color: "#067647", fontWeight: "700", fontSize: 13 },
  tabs: { position: "absolute", left: 0, right: 0, bottom: 0, height: 74, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingBottom: 8 },
  tabButton: { minWidth: 64, height: 44, alignItems: "center", justifyContent: "center" },
  tabText: { color: theme.muted, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: theme.accent },
  chevron: { color: theme.muted, fontSize: 24 },
  discoverCard: { minHeight: 330, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 16, padding: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  bigAvatar: { width: 150, height: 150, borderRadius: 24, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center" },
  bigAvatarText: { color: theme.tagText, fontSize: 42, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10 },
  outlineSmall: { flex: 1, height: 42, borderRadius: theme.radius, borderWidth: 1.5, borderColor: theme.text, alignItems: "center", justifyContent: "center" },
  ctaSmall: { flex: 1, height: 42, borderRadius: theme.radius, backgroundColor: theme.text, alignItems: "center", justifyContent: "center" },
  requestCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: theme.radius, padding: 12, gap: 10 },
  profileHeader: { alignItems: "center", gap: 8 },
  chatTitle: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  chatTitleText: { textAlign: "center", fontSize: 16, fontWeight: "600", color: theme.text },
  chatBody: { padding: theme.screenPadding, gap: 10 },
  bubble: { alignSelf: "flex-start", maxWidth: "78%", backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: theme.accent },
  bubbleText: { color: theme.text, fontSize: 15 },
  bubbleTextMine: { color: "#fff" },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  chatInput: { flex: 1, backgroundColor: theme.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendButton: { borderRadius: 999, backgroundColor: theme.text, paddingHorizontal: 14, paddingVertical: 10 },
});
