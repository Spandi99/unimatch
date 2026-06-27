const express = require("express");
const { createWorker } = require("tesseract.js");

const app = express();
const port = Number(process.env.PORT || 8788);
let workerPromise;

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

    const worker = await getWorker();
    const image = Buffer.from(imageBase64, "base64");
    const result = await worker.recognize(image);

    response.json({
      text: result.data.text,
      confidence: result.data.confidence,
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

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng+deu");
  }
  return workerPromise;
}
