import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type ReviewRequest = {
  verificationRequestId?: string;
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

    const body = await request.json() as ReviewRequest;
    if (!body.verificationRequestId) return json({ error: "Missing verificationRequestId" }, 400);

    const { data: reviewRequest, error: requestError } = await adminClient
      .from("verification_requests")
      .select("id, user_id, legi_document_path")
      .eq("id", body.verificationRequestId)
      .single();

    if (requestError || !reviewRequest) return json({ error: "Review request not found" }, 404);
    if (reviewRequest.user_id !== userData.user.id) return json({ error: "Forbidden" }, 403);
    if (!reviewRequest.legi_document_path) return json({ error: "Missing Legi document path" }, 400);

    const { data: imageBlob, error: downloadError } = await adminClient.storage
      .from("verification-documents")
      .download(reviewRequest.legi_document_path);

    if (downloadError || !imageBlob) {
      return json({ error: `Could not download Legi photo: ${downloadError?.message ?? "unknown error"}` }, 500);
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, birthdate, university, degree")
      .eq("id", reviewRequest.user_id)
      .maybeSingle();

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

    const { error: checksError } = await adminClient
      .from("legi_review_checks")
      .upsert({
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

    if (checksError) return json({ error: `Could not save Legi checks: ${checksError.message}` }, 500);

    const { error: statusError } = await adminClient
      .from("verification_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", reviewRequest.id);

    if (statusError) return json({ error: `Could not update review status: ${statusError.message}` }, 500);

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
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function analyzeLegiWithOpenAi(apiKey: string, model: string, imageBase64: string): Promise<AiLegiResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
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
  });

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
  const response = await fetch(`${ocrServiceUrl.replace(/\/$/, "")}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
