import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

import { supabase } from "./supabase";
import { ProfileDraft } from "./types";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
}

export async function saveProfile(userId: string, draft: ProfileDraft) {
  const photoPath = await withStage("profile photo upload", () => uploadProfilePhoto(userId, draft.photoUri));

  const result = await supabase.from("profiles").upsert({
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

  if (result.error) throw new Error(`profile save failed: ${result.error.message}`);
  return result;
}

export async function createVerificationRequest(userId: string, legiUri: string) {
  const legiDocumentPath = await withStage("Legi photo upload", () => uploadVerificationDocument(userId, legiUri));

  const result = await supabase.from("verification_requests").insert({
    user_id: userId,
    method: "legi_card",
    status: "pending",
    legi_document_path: legiDocumentPath,
  });

  if (result.error) throw new Error(`Legi review request failed: ${result.error.message}`);
  return result;
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
  return uploadImage("profile-photos", `${userId}/profile-${Date.now()}.jpg`, photoUri);
}

async function uploadVerificationDocument(userId: string, photoUri: string) {
  return uploadImage("verification-documents", `${userId}/legi-${Date.now()}.jpg`, photoUri);
}

async function uploadImage(bucket: string, path: string, photoUri: string) {
  const imageBody = await readImageBody(photoUri);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, imageBody, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw new Error(`${bucket} upload failed: ${error.message}`);
  return path;
}

async function readImageBody(photoUri: string) {
  if (Platform.OS === "web") {
    const response = await fetch(photoUri);
    if (!response.ok) throw new Error("Could not read selected image.");
    return response.arrayBuffer();
  }

  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return decode(base64);
}

async function withStage<T>(stage: string, action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`${stage} failed: ${message}`);
  }
}
