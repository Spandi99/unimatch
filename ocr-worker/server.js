const express = require("express");
const { createWorker } = require("tesseract.js");

const app = express();
const port = Number(process.env.PORT || 8788);
let textWorkerPromise;
let numberWorkerPromise;
let sparseWorkerPromise;

app.use(express.json({ limit: "12mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, engine: "tesseract.js" });
});

app.post("/ocr", async (request, response) => {
  try {
    const imageBase64 = request.body?.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      response.status(400).json({ error: "Missing imageBase64" });
      return;
    }

    const textWorker = await getTextWorker();
    const numberWorker = await getNumberWorker();
    const sparseWorker = await getSparseWorker();
    const image = Buffer.from(imageBase64, "base64");
    const [textResult, numberResult, sparseResult] = await Promise.all([
      textWorker.recognize(image),
      numberWorker.recognize(image),
      sparseWorker.recognize(image),
    ]);

    response.json({
      text: textResult.data.text,
      numberText: numberResult.data.text,
      sparseText: sparseResult.data.text,
      confidence: Math.max(textResult.data.confidence ?? 0, numberResult.data.confidence ?? 0, sparseResult.data.confidence ?? 0),
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown OCR error",
    });
  }
});

app.listen(port, () => {
  console.log(`UniMatch OCR worker listening on ${port}`);
});

async function getTextWorker() {
  if (!textWorkerPromise) {
    textWorkerPromise = createWorker("eng+deu");
  }
  return textWorkerPromise;
}

async function getNumberWorker() {
  if (!numberWorkerPromise) {
    numberWorkerPromise = createWorker("eng+deu").then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789- ./",
      });
      return worker;
    });
  }
  return numberWorkerPromise;
}

async function getSparseWorker() {
  if (!sparseWorkerPromise) {
    sparseWorkerPromise = createWorker("eng+deu").then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: "11",
      });
      return worker;
    });
  }
  return sparseWorkerPromise;
}
