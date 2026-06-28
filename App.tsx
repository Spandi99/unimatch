import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Animated,
  Easing,
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
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { theme } from "./src/components/Theme";
import { getAuthRedirectUrl, getPasswordResetRedirectUrl, isAuthCallbackUrl } from "./src/lib/authRedirect";
import {
  VerificationReview,
  createVerificationRequest,
  getLatestVerificationReview,
  resendConfirmationEmail,
  reviewVerificationAutomatically,
  saveProfile,
  sendPasswordResetEmail,
  signInAnonymously,
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
type DemoProfile = {
  initials: string;
  name: string;
  age: number;
  uni: string;
  degree: string;
  distance: string;
  place: string;
  bio: string;
  photo?: number;
};
const demoProfiles: DemoProfile[] = [];
const hotspotCategories = ["All", "Libraries", "Cafes", "Mensa", "Campus"];
const hotspots = [
  { name: "Von-Roll-Bibliothek", category: "Libraries", status: "Jetzt viele da", distance: "~120 m", people: 34, tone: "busy" },
  { name: "Unitobler Bibliothek", category: "Libraries", status: "Ruhig aktiv", distance: "~280 m", people: 18, tone: "active" },
  { name: "Bern main library", category: "Libraries", status: "Gute Lernstimmung", distance: "~450 m", people: 26, tone: "active" },
  { name: "Mensa VonRoll", category: "Mensa", status: "Mittagspause", distance: "~600 m", people: 41, tone: "warm" },
  { name: "Grosse Schanze cafe", category: "Cafes", status: "Gemutlich", distance: "~850 m", people: 12, tone: "warm" },
  { name: "Muesmatt campus", category: "Campus", status: "Nach Vorlesungen", distance: "~1.2 km", people: 22, tone: "active" },
];
const appTabs = ["Nearby", "Hotspots", "Discover", "Matches", "Profile"];
const requestLifetimeHours = 48;
const rememberMeKey = "unimatch.rememberMe";
const pendingSignupEmailKey = "unimatch.pendingSignupEmail";
const pendingSignupPasswordKey = "unimatch.pendingSignupPassword";
const enableTestAuth = process.env.EXPO_PUBLIC_ENABLE_TEST_AUTH === "true";
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
  const [step, setStep] = useState<"auth" | "confirm-email" | "auth-callback" | "onboarding" | "review" | "home">("auth");
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
  const [pendingConfirmationPassword, setPendingConfirmationPassword] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [submitStage, setSubmitStage] = useState("");
  const [review, setReview] = useState<VerificationReview | null>(null);
  const [showInstitutions, setShowInstitutions] = useState(false);
  const [appTab, setAppTab] = useState(0);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);
  const [isNearbyVisible, setIsNearbyVisible] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [requestProfile, setRequestProfile] = useState<number | null>(null);
  const [requestDraft, setRequestDraft] = useState("");
  const [discoverQueue, setDiscoverQueue] = useState(demoProfiles.map((_, index) => index));
  const [outgoingRequests, setOutgoingRequests] = useState<Array<{ profile: DemoProfile; note: string; createdAt: number }>>([]);
  const [selectedHotspot, setSelectedHotspot] = useState(hotspots[0].name);
  const [hotspotFilter, setHotspotFilter] = useState("All");
  const [chatIndex, setChatIndex] = useState<number | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [incomingRequests, setIncomingRequests] = useState<Array<{ profile: DemoProfile; note: string; time: string }>>([]);
  const [matches, setMatches] = useState<Array<{ profile: DemoProfile; messages: Array<{ text: string; mine: boolean }>; time: string }>>([]);
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
  const currentDiscoverIndex = discoverQueue[0] ?? null;
  const selectedDemoProfile = selectedProfile !== null ? demoProfiles[selectedProfile] : null;
  const requestDemoProfile = requestProfile !== null ? demoProfiles[requestProfile] : null;
  const activeOutgoingRequests = outgoingRequests.filter((request) => requestHoursLeft(request.createdAt) > 0);
  const visibleHotspots = hotspots.filter((hotspot) => hotspotFilter === "All" || hotspot.category === hotspotFilter);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const elements = [document.documentElement, document.body, document.getElementById("root")].filter(Boolean) as HTMLElement[];
    const previousStyles = elements.map((element) => ({
      element,
      height: element.style.height,
      minHeight: element.style.minHeight,
      overflow: element.style.overflow,
    }));

    elements.forEach((element) => {
      element.style.height = "100%";
      element.style.minHeight = "100%";
      element.style.overflow = "auto";
    });

    return () => {
      previousStyles.forEach(({ element, height, minHeight, overflow }) => {
        element.style.height = height;
        element.style.minHeight = minHeight;
        element.style.overflow = overflow;
      });
    };
  }, []);

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
        await clearPendingSignup();
        await routeAfterAuthentication(session.user.id);
        setIsBooting(false);
        return;
      }

      const pendingEmail = await AsyncStorage.getItem(pendingSignupEmailKey);
      const pendingPassword = await AsyncStorage.getItem(pendingSignupPasswordKey);
      if (pendingEmail && pendingPassword) {
        setEmail(pendingEmail);
        setPassword(pendingPassword);
        setPendingConfirmationEmail(pendingEmail);
        setPendingConfirmationPassword(pendingPassword);
        setConfirmationMessage("Open the confirmation email, then come back here. UniMatch will continue with the saved login details.");
        setStep("confirm-email");
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
      clearPendingSignup().catch(console.warn);
      setPendingConfirmationEmail("");
      setPendingConfirmationPassword("");
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

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert("Missing details", "Enter your private email and password first.");
      return;
    }

    setAuthMessage("");
    setIsAuthenticating(true);
    try {
      const result = mode === "sign-in"
        ? await signInWithEmail(normalizedEmail, password)
        : await signUpWithEmail(normalizedEmail, password, getAuthRedirectUrl());

      if (result.error) {
        if (mode === "sign-up" && shouldResendConfirmationAfterSignUpError(result.error.message)) {
          await savePendingSignup(normalizedEmail, password);
          await resendConfirmationForEmail(normalizedEmail, password);
          return;
        }

        setAuthMessage(result.error.message);
        Alert.alert("Authentication failed", result.error.message);
        return;
      }

      if (mode === "sign-up" && isExistingAccountSignUpResult(result.data)) {
        await savePendingSignup(normalizedEmail, password);
        setConfirmationMessage(
          "This email is already registered. If it is yours, sign in with the original password or reset the password.",
        );
        setPendingConfirmationEmail(normalizedEmail);
        setStep("confirm-email");
        return;
      }

      const session = result.data.session ?? (await supabase.auth.getSession()).data.session;
      if (!session) {
        const message = mode === "sign-up"
          ? "Account created. Confirm the email we sent you, then UniMatch will continue from here."
          : "No active session yet. If you just created this account, confirm the email first.";
        if (mode === "sign-up") {
          await savePendingSignup(normalizedEmail, password);
          setConfirmationMessage(message);
          setStep("confirm-email");
        }
        setPendingConfirmationEmail(normalizedEmail);
        setAuthMessage(message);
        Alert.alert("Confirm your email", message);
        return;
      }

      await AsyncStorage.setItem(rememberMeKey, rememberMe ? "true" : "false");
      await clearPendingSignup();
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

  async function resendConfirmation() {
    const targetEmail = (pendingConfirmationEmail || email.trim()).toLowerCase();
    if (!targetEmail) {
      Alert.alert("Missing email", "Enter your email first.");
      return;
    }

    setAuthMessage("");
    setConfirmationMessage("");
    setIsAuthenticating(true);
    try {
      await resendConfirmationForEmail(targetEmail, pendingConfirmationPassword || password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not resend confirmation email.";
      setAuthMessage(message);
      setConfirmationMessage(message);
      Alert.alert("Could not resend email", message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function resendConfirmationForEmail(targetEmail: string, targetPassword?: string) {
    const result = await resendConfirmationEmail(targetEmail, getAuthRedirectUrl());
    if (result.error && targetPassword) {
      const retry = await signUpWithEmail(targetEmail, targetPassword, getAuthRedirectUrl());
      if (retry.error && !shouldResendConfirmationAfterSignUpError(retry.error.message)) throw retry.error;
    } else if (result.error) {
      throw result.error;
    }
    setPendingConfirmationEmail(targetEmail);
    setConfirmationMessage("If this account is still unconfirmed, Supabase will send another confirmation email. Check your inbox and spam folder.");
    setAuthMessage("If this account is still unconfirmed, Supabase will send another confirmation email.");
    Alert.alert("Confirmation email sent", "Check your inbox and spam folder, then come back and sign in.");
  }

  async function authenticateTestUser() {
    setAuthMessage("");
    setIsAuthenticating(true);
    try {
      const result = await signInAnonymously();
      if (result.error) throw result.error;

      const session = result.data.session ?? (await supabase.auth.getSession()).data.session;
      if (!session?.user) throw new Error("Test login did not create a session.");

      await AsyncStorage.setItem(rememberMeKey, "true");
      await clearPendingSignup();
      setPendingConfirmationEmail("");
      setPendingConfirmationPassword("");
      setProfileMessage("");
      await routeAfterAuthentication(session.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start test login.";
      setAuthMessage(message);
      Alert.alert("Test login failed", message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function checkConfirmedAndContinue() {
    const targetEmail = (pendingConfirmationEmail || email.trim()).toLowerCase();
    const targetPassword = pendingConfirmationPassword || password;
    if (!targetEmail || !targetPassword) {
      setConfirmationMessage("The saved login details are missing. Go back and enter your email and password again.");
      return;
    }

    setIsAuthenticating(true);
    setConfirmationMessage("Checking confirmation...");
    try {
      const result = await signInWithEmail(targetEmail, targetPassword);
      if (result.error) {
        setConfirmationMessage(
          friendlySignInError(result.error.message),
        );
        return;
      }

      const session = result.data.session ?? (await supabase.auth.getSession()).data.session;
      if (!session?.user) {
        setConfirmationMessage("Email confirmed, but no session was created yet. Try again in a moment.");
        return;
      }

      await AsyncStorage.setItem(rememberMeKey, rememberMe ? "true" : "false");
      await clearPendingSignup();
      setPendingConfirmationEmail("");
      setPendingConfirmationPassword("");
      setConfirmationMessage("");
      await routeAfterAuthentication(session.user.id);
    } catch (error) {
      setConfirmationMessage(error instanceof Error ? error.message : "Could not sign in after confirmation.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function savePendingSignup(targetEmail: string, targetPassword: string) {
    setPendingConfirmationEmail(targetEmail);
    setPendingConfirmationPassword(targetPassword);
    await AsyncStorage.setItem(pendingSignupEmailKey, targetEmail);
    await AsyncStorage.setItem(pendingSignupPasswordKey, targetPassword);
  }

  async function clearPendingSignup() {
    await AsyncStorage.multiRemove([pendingSignupEmailKey, pendingSignupPasswordKey]);
  }

  async function sendPasswordReset() {
    const targetEmail = (pendingConfirmationEmail || email.trim()).toLowerCase();
    if (!targetEmail) {
      setAuthMessage("Enter your email first.");
      setConfirmationMessage("Enter your email first.");
      return;
    }

    setIsAuthenticating(true);
    setConfirmationMessage("");
    try {
      const result = await sendPasswordResetEmail(targetEmail, getPasswordResetRedirectUrl());
      if (result.error) throw result.error;
      await clearPendingSignup();
      setEmail(targetEmail);
      setPassword("");
      setPendingConfirmationEmail("");
      setPendingConfirmationPassword("");
      setStep("auth");
      const message = "Password reset email sent. Set a new password from the email, then sign in here.";
      setAuthMessage(message);
      setConfirmationMessage(message);
      Alert.alert("Password email sent", "Check your inbox and spam folder.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send password reset email.";
      setAuthMessage(message);
      setConfirmationMessage(message);
      Alert.alert("Could not send email", message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  function shouldResendConfirmationAfterSignUpError(message: string) {
    const normalized = message.toLowerCase();
    return normalized.includes("already")
      || normalized.includes("registered")
      || normalized.includes("exists")
      || normalized.includes("user");
  }

  function isExistingAccountSignUpResult(data: unknown) {
    if (!data || typeof data !== "object" || !("user" in data)) return false;
    const user = (data as { user?: { identities?: unknown[] | null } | null }).user;
    return Array.isArray(user?.identities) && user.identities.length === 0;
  }

  function friendlySignInError(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes("email not confirmed")) {
      return "Email is not confirmed yet. Open the newest confirmation email, then tap the button again.";
    }
    if (normalized.includes("invalid login credentials")) {
      return "Email is confirmed, but the password does not match this account. Use the original password or request a password reset email.";
    }
    return message;
  }

  function passDiscoverProfile(index: number) {
    setDiscoverQueue((current) => current.filter((profileIndex) => profileIndex !== index));
  }

  function openRequestForProfile(index: number) {
    setRequestProfile(index);
    setRequestDraft("");
  }

  function requestHoursLeft(createdAt: number) {
    const elapsedHours = (Date.now() - createdAt) / (60 * 60 * 1000);
    return Math.max(0, Math.ceil(requestLifetimeHours - elapsedHours));
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

      let automatedReviewError = "";
      let automatedReview = null as Awaited<ReturnType<typeof reviewVerificationAutomatically>> | null;
      try {
        setSubmitStage("OCR is checking the Legi criteria...");
        automatedReview = await reviewVerificationAutomatically(verificationRequestId);
      } catch (error) {
        automatedReviewError = error instanceof Error ? error.message : "Automatic Legi review failed.";
      }

      setSubmitStage("Loading review result...");
      let latestReview = await refreshReview(data.user.id);
      if (automatedReview) {
        latestReview = {
          id: verificationRequestId,
          status: automatedReview.status,
          created_at: verification.data.created_at,
          reviewed_at: automatedReview.checks.reviewed_at,
          checks: automatedReview.checks,
        };
        setReview(latestReview);
      }
      if (latestReview?.status === "verified") setShowVerifiedBanner(true);
      if (automatedReviewError) {
        setReviewMessage(`Legi uploaded, but automatic OCR did not finish: ${automatedReviewError}`);
      }
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
          <ScrollView style={styles.flex} contentContainerStyle={styles.centerScreen} keyboardShouldPersistTaps="handled">
            <AuthHero compact={Boolean(pendingConfirmationEmail)} />

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
            {enableTestAuth && !pendingConfirmationEmail ? (
              <Pressable style={[styles.outline, isAuthenticating && styles.disabled]} disabled={isAuthenticating} onPress={authenticateTestUser}>
                <Text style={styles.outlineText}>Continue as test user</Text>
              </Pressable>
            ) : null}
            {pendingConfirmationEmail ? (
              <Pressable style={styles.textButton} disabled={isAuthenticating} onPress={resendConfirmation}>
                <Text style={styles.textButtonText}>Send confirmation email again</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.textButton} disabled={isAuthenticating} onPress={sendPasswordReset}>
              <Text style={styles.textButtonText}>Reset password by email</Text>
            </Pressable>
            {authMessage ? <Text style={styles.errorText}>{authMessage}</Text> : null}
          </ScrollView>
        )}

        {!isBooting && step === "confirm-email" && (
          <ScrollView style={styles.flex} contentContainerStyle={styles.centerScreen} keyboardShouldPersistTaps="handled">
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandIconText}>U</Text>
              </View>
              <Text style={styles.brand}>UniMatch</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.title}>Confirm your email</Text>
              <Text style={styles.caption}>
                We sent a confirmation link to {pendingConfirmationEmail || email}. Open the newest email, then come back here.
              </Text>
            </View>

            <View style={styles.notice}>
              <Text style={styles.heading}>Next step</Text>
              <Text style={styles.caption}>
                UniMatch saved the login details for this signup flow and will continue to your profile setup after confirmation.
              </Text>
            </View>

            <Pressable style={[styles.cta, isAuthenticating && styles.disabled]} disabled={isAuthenticating} onPress={checkConfirmedAndContinue}>
              <Text style={styles.ctaText}>{isAuthenticating ? "Checking..." : "I confirmed my email"}</Text>
            </Pressable>
            <Pressable style={styles.outline} disabled={isAuthenticating} onPress={resendConfirmation}>
              <Text style={styles.outlineText}>Send confirmation email again</Text>
            </Pressable>
            <Pressable style={styles.outline} disabled={isAuthenticating} onPress={sendPasswordReset}>
              <Text style={styles.outlineText}>Reset password by email</Text>
            </Pressable>
            <Pressable
              style={styles.textButton}
              disabled={isAuthenticating}
              onPress={async () => {
                await clearPendingSignup();
                setPendingConfirmationEmail("");
                setPendingConfirmationPassword("");
                setConfirmationMessage("");
                setAuthMessage("");
                setStep("auth");
              }}
            >
              <Text style={styles.textButtonText}>Use another email</Text>
            </Pressable>
            {confirmationMessage ? <Text style={styles.errorText}>{confirmationMessage}</Text> : null}
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
          <ScrollView style={styles.flex} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
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
            <BirthdateInput value={draft.birthdate} onChangeText={updateBirthdate} />

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
          <ScrollView style={styles.flex} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
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
            ) : requestDemoProfile ? (
              <RequestComposer
                profile={requestDemoProfile}
                draft={requestDraft}
                onDraft={setRequestDraft}
                onBack={() => setRequestProfile(null)}
                onSend={() => {
                  if (!requestDraft.trim()) {
                    Alert.alert("Missing note", "Write a short request first.");
                    return;
                  }
                  Alert.alert("Request sent", "The chat opens only if they accept.");
                  setOutgoingRequests((current) => [
                    { profile: requestDemoProfile, note: requestDraft.trim(), createdAt: Date.now() },
                    ...current,
                  ]);
                  if (requestProfile !== null) {
                    setDiscoverQueue((current) => current.filter((profileIndex) => profileIndex !== requestProfile));
                  }
                  setRequestProfile(null);
                  setSelectedProfile(null);
                  setRequestDraft("");
                }}
              />
            ) : selectedDemoProfile ? (
              <ProfileDetail
                profile={selectedDemoProfile}
                onBack={() => setSelectedProfile(null)}
                onRequest={() => {
                  setRequestProfile(selectedProfile);
                  setRequestDraft("");
                }}
              />
            ) : (
              <>
                <ScrollView style={styles.flex} contentContainerStyle={styles.screenWithTabs} keyboardShouldPersistTaps="handled">
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
                          <Text style={styles.caption}>{selectedHotspot}</Text>
                        </View>
                        <VisibilityToggle visible={isNearbyVisible} onPress={() => setIsNearbyVisible((value) => !value)} />
                      </View>
                      {!isNearbyVisible ? (
                        <View style={styles.invisibleState}>
                          <VisibilityIcon visible={false} />
                          <Text style={styles.title}>You are invisible</Text>
                          <Text style={styles.caption}>Turn visibility back on to see nearby students and appear at this hotspot.</Text>
                        </View>
                      ) : demoProfiles.length === 0 ? (
                        <EmptyState
                          title="No nearby profiles yet"
                          body="Verified student profiles will appear here once real discovery data is connected."
                        />
                      ) : (
                        demoProfiles.map((profile, index) => (
                          <Pressable key={profile.name} style={styles.profileRow} onPress={() => setSelectedProfile(index)}>
                            <ProfilePhoto profile={profile} style={styles.avatar} imageStyle={styles.avatarImage} />
                            <View style={styles.profileCopy}>
                              <Text style={styles.profileName}>{profile.name}, {profile.age}</Text>
                              <Text style={styles.caption}>{profile.place}</Text>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaPill}>{profile.distance}</Text>
                                <Text style={styles.metaPill}>{profile.degree}</Text>
                              </View>
                            </View>
                            <Text style={styles.chevron}>&gt;</Text>
                          </Pressable>
                        ))
                      )}
                    </>
                  )}
                  {appTab === 1 && (
                    <HotspotsScreen
                      hotspots={visibleHotspots}
                      filters={hotspotCategories}
                      activeFilter={hotspotFilter}
                      selectedHotspot={selectedHotspot}
                      onFilter={setHotspotFilter}
                      onSelect={setSelectedHotspot}
                    />
                  )}
                  {appTab === 2 && (
                    <>
                      {currentDiscoverIndex === null ? (
                        <EmptyDiscover onBrowseHotspots={() => setAppTab(1)} />
                      ) : (
                        <>
                          <DiscoverCard profile={demoProfiles[currentDiscoverIndex]} remaining={discoverQueue.length} pulse={pulse} hotspot={selectedHotspot} />
                          <View style={styles.discoverActions}>
                            <Pressable style={styles.actionCircle} onPress={() => passDiscoverProfile(currentDiscoverIndex)}>
                              <Text style={styles.actionX}>X</Text>
                            </Pressable>
                            <Pressable style={[styles.actionCircle, styles.actionCirclePrimary]} onPress={() => openRequestForProfile(currentDiscoverIndex)}>
                              <MessageIcon />
                            </Pressable>
                          </View>
                        </>
                      )}
                    </>
                  )}
                  {appTab === 3 && (
                    <>
                      <Text style={styles.heading}>Open requests</Text>
                      {activeOutgoingRequests.length === 0 ? (
                        <View style={styles.requestCard}>
                          <Text style={styles.profileName}>No open requests</Text>
                          <Text style={styles.caption}>Requests disappear after 48h without a reply, so the app stays active.</Text>
                        </View>
                      ) : (
                        activeOutgoingRequests.map((request) => (
                          <View key={`${request.profile.name}-${request.createdAt}-${request.note}`} style={styles.requestCard}>
                            <View style={styles.requestHeader}>
                              <ProfilePhoto profile={request.profile} style={styles.smallAvatar} imageStyle={styles.avatarImage} />
                              <View style={styles.profileCopy}>
                                <Text style={styles.profileName}>{request.profile.name}</Text>
                                <Text style={styles.caption}>Auto-removes in {requestHoursLeft(request.createdAt)}h</Text>
                              </View>
                              <Text style={styles.pendingPill}>Pending</Text>
                            </View>
                            <Text style={styles.caption}>{request.note}</Text>
                          </View>
                        ))
                      )}
                      <Text style={styles.heading}>Message requests</Text>
                      {incomingRequests.length === 0 ? (
                        <View style={styles.requestCard}>
                          <Text style={styles.profileName}>No message requests</Text>
                          <Text style={styles.caption}>New requests from verified students will show up here.</Text>
                        </View>
                      ) : incomingRequests.map((request, index) => (
                        <View key={`${request.profile.name}-${request.time}`} style={styles.requestCard}>
                          <View style={styles.requestHeader}>
                            <ProfilePhoto profile={request.profile} style={styles.smallAvatar} imageStyle={styles.avatarImage} />
                            <View style={styles.profileCopy}>
                              <Text style={styles.profileName}>{request.profile.name}</Text>
                              <Text style={styles.caption}>{request.time}</Text>
                            </View>
                          </View>
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
                      {matches.length === 0 ? (
                        <View style={styles.requestCard}>
                          <Text style={styles.profileName}>No chats yet</Text>
                          <Text style={styles.caption}>Accepted requests will open conversations here.</Text>
                        </View>
                      ) : matches.map((match, index) => (
                        <Pressable key={match.profile.name} style={styles.profileRow} onPress={() => setChatIndex(index)}>
                          <ProfilePhoto profile={match.profile} style={styles.avatar} imageStyle={styles.avatarImage} />
                          <View style={styles.profileCopy}>
                            <Text style={styles.profileName}>{match.profile.name}</Text>
                            <Text style={styles.caption}>{match.messages[match.messages.length - 1]?.text}</Text>
                          </View>
                          <Text style={styles.caption}>{match.time}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                  {appTab === 4 && (
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
                    <Pressable key={tab} style={[styles.tabButton, appTab === index && styles.tabButtonActive]} onPress={() => setAppTab(index)}>
                      <TabIcon index={index} active={appTab === index} />
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

function BirthdateInput(props: { value: string; onChangeText: (value: string) => void }) {
  const inputRef = useRef<TextInput>(null);
  const digits = props.value.replace(/\D/g, "").slice(0, 8);
  const mask = "YYYYMMDD";
  const slots = mask.split("").map((placeholder, index) => ({
    value: digits[index] ?? placeholder,
    filled: index < digits.length,
  }));

  return (
    <Pressable style={styles.birthdateField} onPress={() => inputRef.current?.focus()}>
      <View style={styles.birthdateMask} pointerEvents="none">
        {slots.map((slot, index) => (
          <View key={`${slot.value}-${index}`} style={styles.birthdateSlotGroup}>
            <Text style={[styles.birthdateSlot, slot.filled && styles.birthdateSlotFilled]}>{slot.value}</Text>
            {index === 3 || index === 5 ? <Text style={styles.birthdateSlot}>-</Text> : null}
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.birthdateHiddenInput}
        keyboardType="number-pad"
        value={props.value}
        onChangeText={props.onChangeText}
        caretHidden
        maxLength={10}
        accessibilityLabel="Birthdate"
      />
    </Pressable>
  );
}

function AuthHero(props: { compact: boolean }) {
  return (
    <View style={[styles.authHero, props.compact && styles.authHeroCompact]}>
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>U</Text>
        </View>
        <Text style={styles.brand}>UniMatch</Text>
      </View>
      {!props.compact ? (
        <>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLine}>Dein Campus.</Text>
            <Text style={styles.heroLine}>Dein Umfeld.</Text>
            <Text style={styles.heroAccent}>Dein Match?</Text>
          </View>
          <BernScene />
        </>
      ) : null}
    </View>
  );
}

function BernScene() {
  return (
    <View style={styles.bernScene}>
      <View style={styles.mountainBack} />
      <View style={styles.mountainFront} />
      <View style={styles.skyline}>
        <View style={styles.tower}>
          <View style={styles.towerTop} />
        </View>
        <View style={styles.buildingTall} />
        <View style={styles.buildingWide} />
        <View style={styles.buildingSmall} />
      </View>
      <View style={styles.riverLine} />
      <View style={styles.peoplePair}>
        <View style={styles.person} />
        <View style={[styles.person, styles.personRight]} />
      </View>
      <View style={styles.floatingHeart}>
        <Text style={styles.floatingHeartText}>♡</Text>
      </View>
    </View>
  );
}

function TabIcon(props: { index: number; active: boolean }) {
  const colorStyle = props.active ? styles.tabIconActive : styles.tabIconMuted;
  if (props.index === 0) {
    return (
      <View style={styles.pinIcon}>
        <View style={[styles.pinDot, colorStyle]} />
        <View style={[styles.pinStem, colorStyle]} />
      </View>
    );
  }
  if (props.index === 1) {
    return (
      <View style={styles.buildingIcon}>
        <View style={[styles.buildingIconBlock, colorStyle]} />
        <View style={[styles.buildingIconLine, colorStyle]} />
      </View>
    );
  }
  if (props.index === 2) {
    return (
      <View style={styles.discoverIcon}>
        <View style={[styles.discoverIconCircle, colorStyle]} />
        <View style={[styles.discoverIconSpark, colorStyle]} />
      </View>
    );
  }
  if (props.index === 3) {
    return (
      <View style={styles.heartIcon}>
        <Text style={[styles.heartIconText, props.active && styles.heartIconTextActive]}>♡</Text>
      </View>
    );
  }
  return (
    <View style={styles.profileIcon}>
      <View style={[styles.profileIconHead, colorStyle]} />
      <View style={[styles.profileIconBody, colorStyle]} />
    </View>
  );
}

function MessageIcon() {
  return (
    <View style={styles.messageIcon}>
      <View style={styles.messageDot} />
      <View style={styles.messageDot} />
      <View style={styles.messageDot} />
    </View>
  );
}

function VisibilityToggle(props: { visible: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.visible ? "Switch to invisible" : "Switch to visible"}
      style={[styles.visibilityToggle, !props.visible && styles.visibilityToggleOff]}
      onPress={props.onPress}
    >
      <VisibilityIcon visible={props.visible} />
      <Text style={[styles.visibilityText, !props.visible && styles.visibilityTextOff]}>
        {props.visible ? "Visible" : "Invisible"}
      </Text>
    </Pressable>
  );
}

function VisibilityIcon(props: { visible: boolean }) {
  return (
    <View style={[styles.eyeIcon, !props.visible && styles.eyeIconOff]}>
      <View style={[styles.eyePupil, !props.visible && styles.eyePupilOff]} />
      {!props.visible ? <View style={styles.eyeSlash} /> : null}
    </View>
  );
}

function HotspotsScreen(props: {
  hotspots: typeof hotspots;
  filters: string[];
  activeFilter: string;
  selectedHotspot: string;
  onFilter: (filter: string) => void;
  onSelect: (name: string) => void;
}) {
  return (
    <>
      <View style={styles.hotspotHero}>
        <View style={styles.hotspotPin}>
          <Text style={styles.hotspotPinText}>U</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.titleLeft}>Hotspots</Text>
          <Text style={styles.caption}>Choose where you want to be visible on campus.</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {props.filters.map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, props.activeFilter === filter && styles.filterChipActive]}
            onPress={() => props.onFilter(filter)}
          >
            <Text style={[styles.filterText, props.activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {props.hotspots.map((hotspot, index) => (
        <Pressable
          key={hotspot.name}
          style={[styles.hotspotRow, props.selectedHotspot === hotspot.name && styles.hotspotRowSelected]}
          onPress={() => props.onSelect(hotspot.name)}
        >
          <View style={[styles.hotspotPreview, hotspot.tone === "warm" && styles.hotspotPreviewWarm]}>
            <Text style={styles.hotspotPreviewText}>{index + 1}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{hotspot.name}</Text>
            <Text style={[styles.hotspotStatus, hotspot.tone === "warm" && styles.hotspotStatusWarm]}>{hotspot.status}</Text>
            <Text style={styles.caption}>{hotspot.distance}</Text>
          </View>
          <View style={styles.hotspotPeople}>
            <Text style={styles.hotspotPeopleIcon}>2</Text>
            <Text style={styles.hotspotPeopleText}>{hotspot.people}</Text>
          </View>
        </Pressable>
      ))}
    </>
  );
}

function ProfilePhoto(props: { profile: DemoProfile; style: StyleProp<ViewStyle>; imageStyle: StyleProp<ImageStyle> }) {
  return (
    <View style={props.style}>
      {props.profile.photo ? (
        <Image source={props.profile.photo} style={props.imageStyle} resizeMode="cover" />
      ) : (
        <Text style={styles.avatarText}>{props.profile.initials}</Text>
      )}
    </View>
  );
}

function DiscoverCard(props: { profile: DemoProfile; remaining: number; pulse: Animated.Value; hotspot: string }) {
  const lift = props.pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  return (
    <Animated.View style={[styles.discoverCard, { transform: [{ translateY: lift }] }]}>
      <View style={styles.discoverPhoto}>
        {props.profile.photo ? <Image source={props.profile.photo} style={styles.discoverImage} resizeMode="cover" /> : null}
        <View style={styles.photoFrame} />
        <View style={styles.hotspotBadge}>
          <Text style={styles.hotspotBadgeText}>{props.hotspot}</Text>
        </View>
      </View>
      <View style={styles.discoverCopy}>
        <View style={styles.discoverNameRow}>
          <Text style={styles.discoverName}>{props.profile.name}, {props.profile.age}</Text>
          <Text style={styles.stackCount}>{props.remaining} nearby</Text>
        </View>
        <Text style={styles.caption}>{props.profile.uni}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaPill}>{props.profile.distance}</Text>
          <Text style={styles.metaPill}>{props.profile.degree}</Text>
        </View>
        <Text style={styles.bioText}>{props.profile.bio}</Text>
        <Text style={styles.placeText}>{props.profile.place}</Text>
      </View>
    </Animated.View>
  );
}

function EmptyState(props: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyMark}>
        <Text style={styles.emptyMarkText}>U</Text>
      </View>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.caption}>{props.body}</Text>
    </View>
  );
}

function EmptyDiscover(props: { onBrowseHotspots: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyMark}>
        <Text style={styles.emptyMarkText}>U</Text>
      </View>
      <Text style={styles.title}>No profiles in Discover</Text>
      <Text style={styles.caption}>
        Real nearby profiles will appear here after discovery data is connected.
      </Text>
      <Pressable style={styles.outline} onPress={props.onBrowseHotspots}>
        <Text style={styles.outlineText}>View hotspots</Text>
      </Pressable>
    </View>
  );
}

function ProfileDetail(props: { profile: DemoProfile; onBack: () => void; onRequest: () => void }) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backButton} onPress={props.onBack}>
        <Text style={styles.backText}>Back to Nearby</Text>
      </Pressable>
      <View style={styles.discoverCard}>
        <View style={styles.discoverPhoto}>
          {props.profile.photo ? <Image source={props.profile.photo} style={styles.discoverImage} resizeMode="cover" /> : null}
          <View style={styles.photoFrame} />
        </View>
        <View style={styles.discoverCopy}>
          <Text style={styles.discoverName}>{props.profile.name}, {props.profile.age}</Text>
          <Text style={styles.caption}>{props.profile.uni} - {props.profile.degree}</Text>
          <Text style={styles.caption}>{props.profile.place} - {props.profile.distance}</Text>
          <Text style={styles.bioText}>{props.profile.bio}</Text>
        </View>
      </View>
      <Pressable style={styles.cta} onPress={props.onRequest}>
        <Text style={styles.ctaText}>Send message request</Text>
      </Pressable>
    </ScrollView>
  );
}

function RequestComposer(props: { profile: DemoProfile; draft: string; onDraft: (value: string) => void; onBack: () => void; onSend: () => void }) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backButton} onPress={props.onBack}>
        <Text style={styles.backText}>Back to Profile</Text>
      </Pressable>
      <View style={styles.profileHeader}>
        <ProfilePhoto profile={props.profile} style={styles.avatar} imageStyle={styles.avatarImage} />
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

function ChatScreen(props: { match: { profile: DemoProfile; messages: Array<{ text: string; mine: boolean }> }; onBack: () => void; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <View style={styles.flex}>
      <Pressable style={styles.chatTitle} onPress={props.onBack}>
        <Text style={styles.chatTitleText}>Back to Matches - {props.match.profile.name}</Text>
      </Pressable>
      <ScrollView style={styles.flex} contentContainerStyle={styles.chatBody} keyboardShouldPersistTaps="handled">
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
  safe: { flex: 1, backgroundColor: "#faf9f6" },
  flex: { flex: 1 },
  centerScreen: { flexGrow: 1, justifyContent: "center", padding: theme.screenPadding, gap: 20 },
  screen: { padding: theme.screenPadding, gap: 16 },
  screenWithTabs: { padding: theme.screenPadding, paddingBottom: 104, gap: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  brandIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  brandIconText: { color: "#fff", fontWeight: "800" },
  brand: { fontSize: 23, fontWeight: "700", color: theme.text },
  authHero: { gap: 18, alignItems: "stretch" },
  authHeroCompact: { gap: 0 },
  heroCopy: { gap: 2, marginTop: 4 },
  heroLine: { color: theme.text, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  heroAccent: { color: theme.accent, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  bernScene: { height: 176, borderRadius: 28, backgroundColor: "#fbf8ff", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "#efe8ff", marginTop: 4 },
  mountainBack: { position: "absolute", left: -12, right: 80, bottom: 58, height: 84, backgroundColor: "#efeaff", transform: [{ rotate: "-8deg" }], borderRadius: 24 },
  mountainFront: { position: "absolute", left: 70, right: -30, bottom: 44, height: 96, backgroundColor: "#f6f2ff", transform: [{ rotate: "8deg" }], borderRadius: 24 },
  skyline: { position: "absolute", left: 28, right: 22, bottom: 46, height: 80, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  tower: { width: 28, height: 70, borderRadius: 6, backgroundColor: "#fff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#d9cdfa", alignItems: "center" },
  towerTop: { width: 16, height: 16, borderRadius: 8, marginTop: 8, backgroundColor: "#d9cdfa" },
  buildingTall: { width: 42, height: 48, borderRadius: 10, backgroundColor: "#fff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#d9cdfa" },
  buildingWide: { flex: 1, height: 38, borderRadius: 10, backgroundColor: "#fff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#d9cdfa" },
  buildingSmall: { width: 36, height: 30, borderRadius: 10, backgroundColor: "#fff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#d9cdfa" },
  riverLine: { position: "absolute", left: 0, right: 0, bottom: 38, height: 10, backgroundColor: "rgba(155,124,246,0.16)" },
  peoplePair: { position: "absolute", left: 104, bottom: 18, flexDirection: "row", gap: 26 },
  person: { width: 22, height: 38, borderRadius: 11, backgroundColor: "#8d8992" },
  personRight: { backgroundColor: "#413f46" },
  floatingHeart: { position: "absolute", right: 34, top: 30, width: 34, height: 34, borderRadius: 17, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", shadowColor: theme.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  floatingHeartText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  section: { gap: 10 },
  navTitle: { textAlign: "center", fontSize: 15, fontWeight: "700", color: theme.text, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: "700", color: theme.text, textAlign: "center" },
  titleLeft: { fontSize: 22, fontWeight: "700", color: theme.text },
  heading: { fontSize: 16, fontWeight: "700", color: theme.text },
  caption: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  errorText: { color: "#b42318", fontSize: 13, lineHeight: 18, textAlign: "center" },
  progressText: { color: theme.muted, fontSize: 13, lineHeight: 18, textAlign: "center" },
  input: { backgroundColor: theme.elevated, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: theme.text },
  birthdateField: { height: 50, backgroundColor: theme.elevated, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, justifyContent: "center", overflow: "hidden" },
  birthdateMask: { flexDirection: "row", alignItems: "center" },
  birthdateSlotGroup: { flexDirection: "row", alignItems: "center" },
  birthdateSlot: { color: "#b8b1c2", fontSize: 16, lineHeight: 22 },
  birthdateSlotFilled: { color: theme.text },
  birthdateHiddenInput: { ...StyleSheet.absoluteFillObject, color: "transparent", paddingHorizontal: 14, fontSize: 16 },
  select: { backgroundColor: theme.elevated, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
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
  cta: { height: 52, borderRadius: 18, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  outline: { height: 52, borderRadius: 18, backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: "center", justifyContent: "center" },
  outlineText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  textButton: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  textButtonText: { color: theme.accent, fontSize: 14, fontWeight: "600" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.separator, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxChecked: { backgroundColor: theme.text, borderColor: theme.text },
  checkboxText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkLabel: { color: theme.text, fontSize: 14 },
  disabled: { opacity: 0.45 },
  photoBox: { height: 190, borderRadius: 24, backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
  chipSelected: { backgroundColor: theme.tagBg, borderColor: "#b7c6ec", borderWidth: 1 },
  chipText: { color: theme.muted, fontSize: 14, fontWeight: "500" },
  chipTextSelected: { color: theme.tagText },
  notice: { backgroundColor: theme.tagBg, borderRadius: 22, padding: 16, gap: 8 },
  reviewCard: { backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 22, padding: 16, gap: 10 },
  statusText: { alignSelf: "flex-start", backgroundColor: theme.tagBg, color: theme.tagText, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontSize: 13, fontWeight: "600" },
  reviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  reviewLabel: { flex: 1, color: theme.text, fontSize: 14 },
  reviewValue: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  reviewPassed: { color: "#067647" },
  reviewFailed: { color: "#b42318" },
  homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 2 },
  livePill: { backgroundColor: "#ecfdf3", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  livePillText: { color: "#067647", fontSize: 12, fontWeight: "700" },
  visibilityToggle: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#e9f7f1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  visibilityToggleOff: { backgroundColor: "#eeeeee" },
  visibilityText: { color: theme.distanceText, fontSize: 12, fontWeight: "800" },
  visibilityTextOff: { color: "#777777" },
  eyeIcon: { width: 23, height: 15, borderWidth: 1.8, borderColor: theme.distanceText, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  eyeIconOff: { borderColor: "#777777" },
  eyePupil: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.distanceText },
  eyePupilOff: { backgroundColor: "#777777" },
  eyeSlash: { position: "absolute", width: 30, height: 2, borderRadius: 999, backgroundColor: "#777777", transform: [{ rotate: "-32deg" }] },
  invisibleState: { minHeight: 320, backgroundColor: theme.elevated, borderRadius: 24, padding: 24, alignItems: "center", justifyContent: "center", gap: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 1 },
  hotspotHero: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.elevated, borderRadius: 24, padding: 18, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  hotspotPin: { width: 54, height: 54, borderRadius: 20, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center" },
  hotspotPinText: { color: theme.accentDark, fontSize: 22, fontWeight: "900" },
  filterRow: { gap: 8, paddingRight: 16 },
  filterChip: { height: 34, borderRadius: 999, backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: theme.accent },
  filterText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: "#fff" },
  hotspotRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.elevated, borderRadius: 20, padding: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  hotspotRowSelected: { borderWidth: 1.5, borderColor: "#c8b6ff" },
  hotspotPreview: { width: 78, height: 78, borderRadius: 18, backgroundColor: "#eee7ff", alignItems: "center", justifyContent: "center" },
  hotspotPreviewWarm: { backgroundColor: "#fff1dc" },
  hotspotPreviewText: { color: theme.accentDark, fontSize: 24, fontWeight: "900" },
  hotspotStatus: { color: theme.distanceText, fontSize: 13, fontWeight: "700" },
  hotspotStatusWarm: { color: "#d68621" },
  hotspotPeople: { alignItems: "center", gap: 3 },
  hotspotPeopleIcon: { color: theme.accent, fontSize: 11, fontWeight: "900" },
  hotspotPeopleText: { color: theme.muted, fontSize: 12, fontWeight: "800" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.elevated, borderRadius: 18, padding: 13, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  smallAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: theme.tagText, fontSize: 20, fontWeight: "700" },
  profileCopy: { flex: 1, gap: 2 },
  profileName: { color: theme.text, fontSize: 16, fontWeight: "600" },
  requestButton: { borderRadius: 999, backgroundColor: theme.text, paddingHorizontal: 12, paddingVertical: 8 },
  requestButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  backButton: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  successBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "#ecfdf3", borderRadius: 18, padding: 14 },
  dismissText: { color: "#067647", fontWeight: "700", fontSize: 13 },
  tabs: { position: "absolute", left: 12, right: 12, bottom: 12, height: 68, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.97)", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  tabButton: { flex: 1, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 3 },
  tabButtonActive: { backgroundColor: theme.surface },
  tabText: { color: theme.muted, fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: theme.text },
  tabIconActive: { backgroundColor: theme.accent },
  tabIconMuted: { backgroundColor: "#8f8a98" },
  pinIcon: { width: 22, height: 20, alignItems: "center", justifyContent: "center" },
  pinDot: { width: 12, height: 12, borderRadius: 6 },
  pinStem: { width: 4, height: 9, borderRadius: 2, marginTop: -2 },
  buildingIcon: { width: 22, height: 20, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  buildingIconBlock: { width: 17, height: 14, borderRadius: 3 },
  buildingIconLine: { width: 22, height: 3, borderRadius: 2 },
  discoverIcon: { width: 22, height: 20, alignItems: "center", justifyContent: "center" },
  discoverIconCircle: { width: 15, height: 15, borderRadius: 8 },
  discoverIconSpark: { position: "absolute", right: 1, top: 1, width: 7, height: 7, borderRadius: 4 },
  heartIcon: { width: 22, height: 20, alignItems: "center", justifyContent: "center" },
  heartIconText: { color: "#8f8a98", fontSize: 21, fontWeight: "900", lineHeight: 22 },
  heartIconTextActive: { color: theme.accent },
  profileIcon: { width: 22, height: 20, alignItems: "center", justifyContent: "center" },
  profileIconHead: { width: 8, height: 8, borderRadius: 4 },
  profileIconBody: { width: 18, height: 8, borderRadius: 8, marginTop: 2 },
  chevron: { color: theme.muted, fontSize: 20, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  metaPill: { alignSelf: "flex-start", backgroundColor: theme.surface, color: theme.text, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "700" },
  discoverCard: { minHeight: 452, backgroundColor: theme.elevated, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 4 },
  discoverPhoto: { height: 260, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  discoverImage: { width: "100%", height: "100%" },
  photoFrame: { position: "absolute", left: 12, right: 12, top: 12, bottom: 12, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  hotspotBadge: { position: "absolute", left: 16, top: 16, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 11, paddingVertical: 6 },
  hotspotBadgeText: { color: theme.text, fontSize: 12, fontWeight: "800" },
  discoverCopy: { padding: 18, gap: 10 },
  discoverNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  discoverName: { flex: 1, color: theme.text, fontSize: 24, fontWeight: "700" },
  stackCount: { color: theme.distanceText, backgroundColor: theme.distanceBg, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "700" },
  bioText: { color: theme.text, fontSize: 15, lineHeight: 21 },
  placeText: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  bigAvatar: { width: 150, height: 150, borderRadius: 24, backgroundColor: theme.tagBg, alignItems: "center", justifyContent: "center" },
  bigAvatarText: { color: theme.tagText, fontSize: 60, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10 },
  outlineSmall: { flex: 1, height: 44, borderRadius: 16, backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: "center", justifyContent: "center" },
  ctaSmall: { flex: 1, height: 44, borderRadius: 16, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  discoverActions: { flexDirection: "row", justifyContent: "center", gap: 18 },
  actionCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.elevated, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  actionCirclePrimary: { backgroundColor: theme.accent },
  actionX: { color: "#8f8a98", fontSize: 25, fontWeight: "800" },
  messageIcon: { width: 28, height: 22, borderRadius: 12, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  messageDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent },
  passButton: { flex: 1, height: 54, borderRadius: 999, backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: "center", justifyContent: "center" },
  passButtonText: { color: theme.muted, fontSize: 15, fontWeight: "700" },
  requestButtonLarge: { flex: 1.25, height: 54, borderRadius: 999, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  requestButtonLargeText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyState: { minHeight: 380, backgroundColor: theme.elevated, borderRadius: 24, padding: 24, alignItems: "center", justifyContent: "center", gap: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  emptyMark: { width: 64, height: 64, borderRadius: 22, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  emptyMarkText: { color: theme.text, fontSize: 24, fontWeight: "800" },
  requestCard: { backgroundColor: theme.elevated, borderRadius: 18, padding: 14, gap: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  requestHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  pendingPill: { alignSelf: "flex-start", backgroundColor: theme.surface, color: theme.muted, borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: "800" },
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
