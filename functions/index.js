/**
 * Hubsy — Creative Hub Kosovo AI Brand Assistant
 * Firebase Functions (v2, HTTPS) backend for the embeddable chat widget.
 *
 * Endpoint: POST { message, history?, language? }
 * Response: { reply, fallback }
 *
 * Requires the GEMINI_API_KEY secret:
 *   firebase functions:secrets:set GEMINI_API_KEY
 *
 * Optional env vars:
 *   GEMINI_MODEL     (default: gemini-2.5-flash)
 *   ALLOWED_ORIGINS  comma-separated origins, or * (default: *)
 */

const fs = require("fs");
const path = require("path");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");

const REGION = "europe-west1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 12;
const MAX_TURN_CHARS = 4000;

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CORS = ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS;

// --- Load the system prompt + knowledge base (bundled via predeploy sync) ---
const DATA_DIR = path.join(__dirname, "data");
const SYSTEM_PROMPT = fs.readFileSync(path.join(DATA_DIR, "system-prompt.txt"), "utf8");

const KNOWLEDGE_BASE = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "knowledge-base.json"), "utf8")
);

const KB_TEXT = KNOWLEDGE_BASE
  .filter((e) => e && e.topic && e.answer)
  .map((e) => `- ${e.topic}: ${e.answer}`)
  .join("\n");

const SYSTEM_INSTRUCTION =
  SYSTEM_PROMPT.trim() +
  "\n\n=== KNOWLEDGE BASE (source of truth) ===\n" +
  "Use only the facts below. Quote figures exactly. If the answer is not here, " +
  "use the fallback routing described above.\n\n" +
  KB_TEXT;

// Server-side fallback, used only if the model returns no usable text.
const SAFETY_FALLBACK =
  "Për këtë pyetje nuk kam informacion të saktë, prandaj nuk dua të hamendësoj. " +
  "Ju lutem kontaktoni Creative Hub Kosovo:\n" +
  "• Data Engineering, Vibe Coding, Product & Project Management, Full-stack Development: " +
  "+383 49 334 437 · flaka@creativehubkos.com\n" +
  "• Data Science, Digital Marketing, HR: " +
  "+383 49 334 438 · leonita@creativehubkos.com";

let client = null;
function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: geminiApiKey.value() });
  }
  return client;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content.slice(0, MAX_TURN_CHARS) }]
    }));
}

exports.hubsyChat = onRequest(
  { region: REGION, cors: CORS, secrets: [geminiApiKey], timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: "Missing 'message'." });
      return;
    }

    const contents = sanitizeHistory(body.history);
    contents.push({ role: "user", parts: [{ text: message.slice(0, MAX_MESSAGE_CHARS) }] });

    try {
      const response = await getClient().models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.25,
          maxOutputTokens: 900
        }
      });

      const reply = (response && typeof response.text === "string" ? response.text : "").trim();
      if (!reply) {
        res.status(200).json({ reply: SAFETY_FALLBACK, fallback: true });
        return;
      }
      res.status(200).json({ reply: reply, fallback: false });
    } catch (err) {
      console.error("[hubsyChat] Gemini error:", err);
      res.status(502).json({ error: "Upstream model error", reply: SAFETY_FALLBACK, fallback: true });
    }
  }
);
