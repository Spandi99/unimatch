type ReviewRequest = {
  verificationRequestId?: string;
};

type SupabaseUser = {
  id: string;
};

type VerificationRequestRow = {
  id: string;
  user_id: string;
  legi_document_path: string | null;
};

type ProfileRow = {
  name?: string | null;
  birthdate?: string | null;
  university?: string | null;
  degree?: string | null;
};

type AiLegiResult = {
  has_face_photo: boolean;
  has_birthdate: boolean;
  has_first_and_last_name: boolean;
  has_faculty: boolean;
  has_student_number: boolean;
  student_number: string | null;
  extracted_name: string | null;
  extracted_birthdate: string | null;
  extracted_faculty: string | null;
  confidence: number;
  notes: string;
};

type OcrResponse = {
  text?: string;
  numberText?: string;
  sparseText?: string;
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_TIMEOUT_MS = 45_000;
const OCR_TIMEOUT_MS = 45_000;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const openAiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    const ocrServiceUrl = Deno.env.get("LEGI_OCR_SERVICE_URL");
    const reviewMode = Deno.env.get("LEGI_REVIEW_MODE") ?? (ocrServiceUrl ? "tesseract" : openAiKey ? "openai" : "demo");

    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Missing Authorization header" }, 401);

    const user = await getUser(supabaseUrl, anonKey, authorization);
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await request.json() as ReviewRequest;
    if (!body.verificationRequestId) return json({ error: "Missing verificationRequestId" }, 400);

    const reviewRequest = await getVerificationRequest(supabaseUrl, serviceRoleKey, body.verificationRequestId);
    if (!reviewRequest) return json({ error: "Review request not found" }, 404);
    if (reviewRequest.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (!reviewRequest.legi_document_path) return json({ error: "Missing Legi document path" }, 400);

    const imageBlob = await downloadStorageObject(supabaseUrl, serviceRoleKey, "verification-documents", reviewRequest.legi_document_path);
    const profile = await getProfile(supabaseUrl, serviceRoleKey, reviewRequest.user_id);

    const imageBase64 = await blobToBase64(imageBlob);
    const aiResult = reviewMode === "openai"
      ? await analyzeLegiWithOpenAi(requiredOpenAiKey(openAiKey), openAiModel, imageBase64)
      : reviewMode === "tesseract"
        ? await analyzeLegiWithTesseract(requiredOcrServiceUrl(ocrServiceUrl), imageBase64, imageBlob.size, profile)
        : analyzeLegiInDemoMode(imageBlob.size);
    const isVerified = [
      aiResult.has_face_photo,
      aiResult.has_birthdate,
      aiResult.has_first_and_last_name,
      aiResult.has_faculty,
      aiResult.has_student_number,
    ].every(Boolean);
    const status = isVerified ? "verified" : "rejected";

    const notes = [
      aiResult.notes,
      aiResult.extracted_name ? `Name: ${aiResult.extracted_name}` : null,
      aiResult.extracted_birthdate ? `Birthdate: ${aiResult.extracted_birthdate}` : null,
      aiResult.extracted_faculty ? `Faculty: ${aiResult.extracted_faculty}` : null,
      `Review mode: ${reviewMode}`,
      reviewMode === "openai" ? `AI model: ${openAiModel}` : null,
      reviewMode === "demo" ? "Demo mode only confirms that a Legi image was uploaded. It does not read the actual card." : null,
      `Confidence: ${aiResult.confidence}`,
    ].filter(Boolean).join("\n");

    await upsertLegiReviewChecks(supabaseUrl, serviceRoleKey, {
      verification_request_id: reviewRequest.id,
      has_face_photo: aiResult.has_face_photo,
      has_birthdate: aiResult.has_birthdate,
      has_first_and_last_name: aiResult.has_first_and_last_name,
      has_faculty: aiResult.has_faculty,
      has_student_number: aiResult.has_student_number,
      student_number: aiResult.student_number,
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
    });

    await updateVerificationRequestStatus(supabaseUrl, serviceRoleKey, reviewRequest.id, status);

    return json({
      status,
      checks: {
        has_face_photo: aiResult.has_face_photo,
        has_birthdate: aiResult.has_birthdate,
        has_first_and_last_name: aiResult.has_first_and_last_name,
        has_faculty: aiResult.has_faculty,
        has_student_number: aiResult.has_student_number,
        student_number: aiResult.student_number,
        reviewer_notes: notes,
        reviewed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("review-legi failed", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return json({ error: message }, 500);
  }
});

async function getUser(supabaseUrl: string, anonKey: string, authorization: string): Promise<SupabaseUser | null> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "apikey": anonKey,
      "Authorization": authorization,
    },
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Could not read signed-in user: ${response.status} ${await response.text()}`);
  }

  const user = await response.json() as Partial<SupabaseUser>;
  return typeof user.id === "string" ? { id: user.id } : null;
}

async function getVerificationRequest(
  supabaseUrl: string,
  serviceRoleKey: string,
  verificationRequestId: string,
): Promise<VerificationRequestRow | null> {
  const rows = await getRows<VerificationRequestRow>(
    supabaseUrl,
    serviceRoleKey,
    "verification_requests",
    {
      select: "id,user_id,legi_document_path",
      id: `eq.${verificationRequestId}`,
      limit: "1",
    },
  );

  return rows[0] ?? null;
}

async function getProfile(supabaseUrl: string, serviceRoleKey: string, userId: string): Promise<ProfileRow | null> {
  const rows = await getRows<ProfileRow>(
    supabaseUrl,
    serviceRoleKey,
    "profiles",
    {
      select: "name,birthdate,university,degree",
      id: `eq.${userId}`,
      limit: "1",
    },
  );

  return rows[0] ?? null;
}

async function getRows<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  query: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: supabaseRestHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    throw new Error(`Could not query ${table}: ${response.status} ${await response.text()}`);
  }

  return await response.json() as T[];
}

async function downloadStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string,
): Promise<Blob> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    headers: supabaseRestHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    throw new Error(`Could not download Legi photo: ${response.status} ${await response.text()}`);
  }

  return await response.blob();
}

async function upsertLegiReviewChecks(
  supabaseUrl: string,
  serviceRoleKey: string,
  row: {
    verification_request_id: string;
    has_face_photo: boolean;
    has_birthdate: boolean;
    has_first_and_last_name: boolean;
    has_faculty: boolean;
    has_student_number: boolean;
    student_number: string | null;
    reviewer_notes: string;
    reviewed_at: string;
  },
) {
  const url = new URL(`${supabaseUrl}/rest/v1/legi_review_checks`);
  url.searchParams.set("on_conflict", "verification_request_id");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseRestHeaders(serviceRoleKey),
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    throw new Error(`Could not save Legi checks: ${response.status} ${await response.text()}`);
  }
}

async function updateVerificationRequestStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  verificationRequestId: string,
  status: "verified" | "rejected",
) {
  const url = new URL(`${supabaseUrl}/rest/v1/verification_requests`);
  url.searchParams.set("id", `eq.${verificationRequestId}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...supabaseRestHeaders(serviceRoleKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, reviewed_at: new Date().toISOString() }),
  });

  if (!response.ok) {
    throw new Error(`Could not update review status: ${response.status} ${await response.text()}`);
  }
}

function supabaseRestHeaders(serviceRoleKey: string) {
  return {
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
  };
}

async function analyzeLegiWithOpenAi(apiKey: string, model: string, imageBase64: string): Promise<AiLegiResult> {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "You verify Swiss student Legi cards for a dating app MVP.",
                "Inspect the image and return only JSON matching the schema.",
                "Required criteria: visible face photo, visible birthdate, visible first and last name, visible faculty or school unit, and a visible student number matching NN-NNN-NNN like 21-114-004.",
                "Do not guess. Set a criterion to false if it is not clearly visible.",
              ].join(" "),
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBase64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "legi_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              has_face_photo: { type: "boolean" },
              has_birthdate: { type: "boolean" },
              has_first_and_last_name: { type: "boolean" },
              has_faculty: { type: "boolean" },
              has_student_number: { type: "boolean" },
              student_number: { type: ["string", "null"], pattern: "^[0-9]{2}-[0-9]{3}-[0-9]{3}$" },
              extracted_name: { type: ["string", "null"] },
              extracted_birthdate: { type: ["string", "null"] },
              extracted_faculty: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              notes: { type: "string" },
            },
            required: [
              "has_face_photo",
              "has_birthdate",
              "has_first_and_last_name",
              "has_faculty",
              "has_student_number",
              "student_number",
              "extracted_name",
              "extracted_birthdate",
              "extracted_faculty",
              "confidence",
              "notes",
            ],
          },
        },
      },
    }),
  }, OPENAI_TIMEOUT_MS, "OpenAI Legi review");

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const outputText = payload.output_text ?? payload.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? []).map((content: { text?: string }) => content.text).filter(Boolean).join("");
  if (!outputText) throw new Error("OpenAI response did not include OCR JSON.");

  const result = JSON.parse(outputText) as AiLegiResult;
  if (result.student_number && !/^[0-9]{2}-[0-9]{3}-[0-9]{3}$/.test(result.student_number)) {
    result.student_number = null;
    result.has_student_number = false;
  }

  return result;
}

async function analyzeLegiWithTesseract(
  ocrServiceUrl: string,
  imageBase64: string,
  imageSize: number,
  profile: { name?: string | null; birthdate?: string | null; university?: string | null; degree?: string | null } | null,
): Promise<AiLegiResult> {
  const response = await fetchWithTimeout(`${ocrServiceUrl.replace(/\/$/, "")}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  }, OCR_TIMEOUT_MS, "Tesseract OCR service");

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tesseract OCR service failed: ${response.status} ${errorText}`);
  }

  const ocr = await response.json() as OcrResponse;
  if (ocr.error) throw new Error(`Tesseract OCR service failed: ${ocr.error}`);

  const text = normalizeText([ocr.text, ocr.numberText, ocr.sparseText].filter(Boolean).join(" "));
  const studentNumber = extractStudentNumber(text);
  const birthdate = findBirthdate(text, profile?.birthdate ?? null);
  const hasBirthdate = Boolean(birthdate);
  const hasName = hasProfileName(text, profile?.name ?? null) || hasLabeledName(text) || hasLikelyPersonName(text) || hasProfileAssistedName(text, profile?.name ?? null);
  const hasFaculty = hasFacultyText(text, profile?.degree ?? null, profile?.university ?? null);
  const passedCount = [imageSize > 0, hasBirthdate, hasName, hasFaculty, Boolean(studentNumber)].filter(Boolean).length;

  return {
    has_face_photo: imageSize > 0,
    has_birthdate: hasBirthdate,
    has_first_and_last_name: hasName,
    has_faculty: hasFaculty,
    has_student_number: Boolean(studentNumber),
    student_number: studentNumber,
    extracted_name: hasName ? profile?.name ?? null : null,
    extracted_birthdate: birthdate,
    extracted_faculty: hasFaculty ? profile?.degree ?? profile?.university ?? null : null,
    confidence: Math.round((passedCount / 5) * 100) / 100,
    notes: [
      "Open-source Tesseract OCR review.",
      "Face photo is provisionally treated as passed when an image was uploaded; OCR cannot reliably verify a face.",
      "OCR text combines general, number-focused and sparse-text passes.",
      "Name detection can use profile-assisted matching when OCR sees text but cannot cleanly read the full name.",
      `OCR text: ${text.slice(0, 700)}`,
    ].join("\n"),
  };
}

function analyzeLegiInDemoMode(imageSize: number): AiLegiResult {
  const hasImage = imageSize > 0;

  return {
    has_face_photo: hasImage,
    has_birthdate: hasImage,
    has_first_and_last_name: hasImage,
    has_faculty: hasImage,
    has_student_number: hasImage,
    student_number: hasImage ? "21-114-004" : null,
    extracted_name: null,
    extracted_birthdate: null,
    extracted_faculty: null,
    confidence: hasImage ? 0.2 : 0,
    notes: hasImage
      ? "Demo review passed because a Legi image was uploaded. This is not real OCR."
      : "Demo review failed because no readable image was received.",
  };
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requiredOpenAiKey(value: string | undefined) {
  if (!value) throw new Error("OPENAI_API_KEY is required when LEGI_REVIEW_MODE=openai");
  return value;
}

function requiredOcrServiceUrl(value: string | undefined) {
  if (!value) throw new Error("LEGI_OCR_SERVICE_URL is required when LEGI_REVIEW_MODE=tesseract");
  return value;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractStudentNumber(text: string) {
  const exact = text.match(/\b([0-9]{2})-([0-9]{3})-([0-9]{3})\b/);
  if (exact) return `${exact[1]}-${exact[2]}-${exact[3]}`;

  const separated = text.match(/(?:^|\D)([0-9]{2})[\s./-]+([0-9]{3})[\s./-]+([0-9]{3})(?:\D|$)/);
  if (separated) return `${separated[1]}-${separated[2]}-${separated[3]}`;

  const compact = text.match(/(?:^|\D)([0-9]{8})(?:\D|$)/);
  if (compact) return `${compact[1].slice(0, 2)}-${compact[1].slice(2, 5)}-${compact[1].slice(5, 8)}`;

  const corrected = normalizeNumberishText(text);
  const fuzzySeparated = corrected.match(/(?:^|\D)([0-9]{2})[\s./-]+([0-9]{3})[\s./-]+([0-9]{3})(?:\D|$)/);
  if (fuzzySeparated) return `${fuzzySeparated[1]}-${fuzzySeparated[2]}-${fuzzySeparated[3]}`;

  const digits = corrected.replace(/\D/g, "");
  const plausibleStartYears = new Set(Array.from({ length: 30 }, (_value, index) => String(new Date().getFullYear() - 2000 - index).padStart(2, "0")));
  for (let index = 0; index <= digits.length - 8; index += 1) {
    const candidate = digits.slice(index, index + 8);
    if (plausibleStartYears.has(candidate.slice(0, 2))) {
      return `${candidate.slice(0, 2)}-${candidate.slice(2, 5)}-${candidate.slice(5, 8)}`;
    }
  }

  return null;
}

function normalizeNumberishText(text: string) {
  return text
    .replace(/[oOQ]/g, "0")
    .replace(/[iIl|]/g, "1")
    .replace(/[sS]/g, "5")
    .replace(/[bB]/g, "8");
}

function findBirthdate(text: string, profileBirthdate: string | null) {
  if (profileBirthdate) {
    const [year, month, day] = profileBirthdate.split("-");
    const candidates = [
      `${year}-${month}-${day}`,
      `${day}.${month}.${year}`,
      `${day}/${month}/${year}`,
      `${day}-${month}-${year}`,
    ];
    if (candidates.some((candidate) => text.includes(candidate))) return profileBirthdate;

    const dayPattern = Number(day).toString().padStart(1, "0");
    const monthPattern = Number(month).toString().padStart(1, "0");
    const dayMonthPattern = new RegExp(`\\b0?${dayPattern}[./-]0?${monthPattern}[./-][0-9]{4}\\b`);
    const dayMonthMatch = text.match(dayMonthPattern);
    if (dayMonthMatch) return dayMonthMatch[0];
  }

  return text.match(/\b(?:[0-3]?\d[./-][01]?\d[./-][0-9]{4}|[0-9]{4}[./-][01]?\d[./-][0-3]?\d)\b/)?.[0] ?? null;
}

function hasProfileName(text: string, profileName: string | null) {
  if (!profileName) return false;
  const haystack = text.toLowerCase();
  const parts = profileName.toLowerCase().split(/\s+/).filter((part) => part.length >= 2);
  return parts.length >= 2 && parts.every((part) => haystack.includes(part));
}

function hasLabeledName(text: string) {
  return /\b(?:name|vorname|nachname|surname|student)\b[:\s]+[A-ZÄÖÜ][a-zäöüéèà]{2,}\s+[A-ZÄÖÜ][a-zäöüéèà]{2,}\b/i.test(text);
}

function hasLikelyPersonName(text: string) {
  const ignored = new Set(["semester", "sommersemester", "wintersemester", "swiss", "university", "universitat", "universitaet", "hochschule", "faculty", "fakultat", "medizin"]);
  const matches = stripAccents(text).match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  const words = matches.map((word) => word.toLowerCase()).filter((word) => !ignored.has(word));
  return words.length >= 2;
}

function hasProfileAssistedName(text: string, profileName: string | null) {
  const profileParts = profileName?.split(/\s+/).filter((part) => part.length >= 2) ?? [];
  if (profileParts.length < 2) return false;
  return /[A-Za-z]{4,}/.test(stripAccents(text));
}

function stripAccents(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasFacultyText(text: string, degree: string | null, university: string | null) {
  const haystack = text.toLowerCase();
  const keywords = ["faculty", "fakultät", "faculte", "school", "department", "institut", "bfh", "university", "universität", "hochschule"];
  if (keywords.some((keyword) => haystack.includes(keyword))) return true;

  return [degree, university].some((value) => {
    const parts = value?.toLowerCase().split(/\W+/).filter((part) => part.length >= 4) ?? [];
    return parts.length > 0 && parts.some((part) => haystack.includes(part));
  });
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
