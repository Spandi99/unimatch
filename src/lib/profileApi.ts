import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";

import { supabase } from "./supabase";
import { ProfileDraft } from "./types";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function saveProfile(userId: string, draft: ProfileDraft) {
  const photoPath = await uploadProfilePhoto(userId, draft.photoUri);

  return supabase.from("profiles").upsert({
    id: userId,
    name: draft.name,
    birthdate: draft.birthdate,
    gender: draft.gender,
    wants_to_meet: draft.wantsToMeet,
    university: draft.university ?? null,
    degree: draft.degree ?? null,
    bio: draft.bio ?? "",
    photo_path: photoPath,
  });
}

export async function createVerificationRequest(userId: string, method: "switch_edu_id" | "legi_card") {
  return supabase.from("verification_requests").insert({
    user_id: userId,
    method,
    status: method === "switch_edu_id" ? "verified" : "pending",
  });
}

export async function sendMessageRequest(recipientId: string, note: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not signed in");

  return supabase.from("message_requests").insert({
    sender_id: user.user.id,
    recipient_id: recipientId,
    note,
  });
}

async function uploadProfilePhoto(userId: string, photoUri: string) {
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${userId}/profile.jpg`;

  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(path, decode(base64), {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;
  return path;
}
