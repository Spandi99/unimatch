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

export async function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
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

export async function createVerificationRequest(userId: string, legiUri: string) {
  const legiDocumentPath = await uploadVerificationDocument(userId, legiUri);

  return supabase.from("verification_requests").insert({
    user_id: userId,
    method: "legi_card",
    status: "pending",
    legi_document_path: legiDocumentPath,
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
  return uploadImage("profile-photos", `${userId}/profile.jpg`, photoUri);
}

async function uploadVerificationDocument(userId: string, photoUri: string) {
  return uploadImage("verification-documents", `${userId}/legi.jpg`, photoUri);
}

async function uploadImage(bucket: string, path: string, photoUri: string) {
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;
  return path;
}
