export type GenderIdentity =
  | "woman"
  | "man"
  | "non_binary"
  | "genderqueer"
  | "agender"
  | "trans_woman"
  | "trans_man"
  | "prefer_not_to_say";

export type ProfileDraft = {
  name: string;
  birthdate: string;
  gender: GenderIdentity;
  wantsToMeet: string[];
  photoUri: string;
  legiUri: string;
  university?: string;
  degree?: string;
  bio?: string;
};

export type PublicProfile = {
  id: string;
  name: string;
  birthdate: string;
  gender: GenderIdentity;
  wants_to_meet: string[];
  university: string | null;
  degree: string | null;
  bio: string | null;
  photo_path: string | null;
};
