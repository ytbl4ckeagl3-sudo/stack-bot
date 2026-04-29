require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { createClient } = require("@supabase/supabase-js");
const Groq = require("groq-sdk");

let toFile = null;
try {
  toFile = require("groq-sdk/uploads").toFile;
} catch (_) {}

let WebUntis = null;
try {
  const webUntisModule = require("webuntis");
  WebUntis = webUntisModule.WebUntis || webUntisModule.default || webUntisModule;
} catch (_) {}

process.env.TZ = process.env.TZ || "Europe/Berlin";

const PORT = Number(process.env.PORT || 3000);
const COMMAND_DIR = path.join(__dirname, "commands");
const PREFIX_RE = /^(Stack|Stak|Stacck|Stakk),/i;
const SYSTEM_PROMPT =
  "Antworte IMMER auf Deutsch. Egal was User schreibt. Du bist Stack, ein knapper, hilfreicher WhatsApp-Bot. Sprich locker, direkt und nuetzlich.";

const envBool = (name, fallback = false) => {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const envList = (name) =>
  String(process.env[name] || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const normalizeNumber = (value) => String(value || "").replace(/\D/g, "");
const mainNumber = normalizeNumber(process.env.MAIN_NUMBER);
const whitelistNumbers = new Set(envList("WHITELIST_NUMBERS").map(normalizeNumber));
const groupWhitelist = new Set(envList("GROUP_WHITELIST"));
const requireWhitelist = envBool("REQUIRE_WHITELIST", false);
const allowGuests = envBool("ALLOW_GUESTS", true);
const allowGroups = envBool("ALLOW_GROUPS", true);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 6);
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const guestDailyCredits = Number(process.env.GUEST_DAILY_CREDITS || 20);
const websearchDailyLimit = Number(process.env.WEBSEARCH_DAILY_LIMIT || 10);
const startDelayMs = Number(process.env.START_DELAY_MS || 30000);
const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS || 35000);
const denkTimeoutMs = 120000;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      })
    : null;

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const app = express();
app.use(express.json({ limit: "2mb" }));

let client = null;
let botReady = false;
let lastQr = "";
let killed = envBool("KILL_SWITCH", false);
let commands = [];
let lastUntisFailNotice = 0;

const rateBuckets = new Map();
const guestBuckets = new Map();
const websearchBuckets = new Map();

function mainChatId() {
  return mainNumber ? `${mainNumber}@c.us` : "";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function expiresFor(isEphemeral) {
  return isEphemeral ? addHours(new Date(), 12) : addDays(new Date(), 90);
}

function chunkText(text, size = 3500) {
  const clean = String(text || "").trim();
  if (!clean) return ["Okay."];
  const chunks = [];
  for (let i = 0; i < clean.length; i += size) chunks.push(clean.slice(i, i + size));
  return chunks;
}

function withTimeout(promise, ms, label = "Timeout") {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

function hasCronAccess(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.query.key === secret || req.header("x-cron-secret") === secret;
}

function loadCommands() {
  if (!fs.existsSync(COMMAND_DIR)) fs.mkdirSync(COMMAND_DIR, { recursive: true });

  commands = fs
    .readdirSync(COMMAND_DIR)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => {
      const fullPath = path.join(COMMAND_DIR, file);
      delete require.cache[require.resolve(fullPath)];
      const mod = require(fullPath);
      if (!mod.trigger || !(mod.trigger instanceof RegExp)) {
        throw new Error(`${file} braucht export.trigger als RegExp`);
      }
      if (typeof mod.execute !== "function") {
        throw new Error(`${file} braucht export.execute(context)`);
      }
      return {
        file,
        name: mod.name || file.replace(/\.js$/, ""),
        description: mod.description || "",
        trigger: mod.trigger,
        execute: mod.execute
      };
    });

  console.log(`Commands geladen: ${commands.map((cmd) => cmd.file).join(", ")}`);
}

function buildContext(msg, body) {
  const isGroup = msg.from.endsWith("@g.us");
  const senderId = isGroup ? msg.author || msg.from : msg.from;
  const senderNumber = normalizeNumber(senderId);
  const isMain = Boolean(mainNumber && senderNumber === mainNumber);
  const isEphemeral = isGroup || !isMain;

  return {
    msg,
    client,
    supabase,
    groq,
    env: process.env,
    commands,
    commandDir: COMMAND_DIR,
    rawBody: body,
    body: "",
    chatId: msg.from,
    senderId,
    senderNumber,
    isGroup,
    isMain,
    isEphemeral,
    expiresAt: expiresFor(isEphemeral),
    helpers
  };
}

function isAllowed(context) {
  if (context.isGroup) {
    if (!allowGroups) return false;
    if (groupWhitelist.has("*") || groupWhitelist.has(context.chatId)) return true;
    return context.isMain || whitelistNumbers.has(context.senderNumber);
  }

  if (context.isMain || whitelistNumbers.has(context.senderNumber)) return true;
  if (requireWhitelist) return false;
  return allowGuests;
}

function consumeRateLimit(context) {
  const key = context.senderNumber || context.chatId;
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((time) => now - time < rateLimitWindowMs);
  if (bucket.length >= rateLimitMax) {
    rateBuckets.set(key, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  return true;
}

function consumeGuestCredit(context) {
  if (context.isMain || whitelistNumbers.has(context.senderNumber)) return true;
  const key = `${todayKey()}:${context.senderNumber}`;
  const used = guestBuckets.get(key) || 0;
  if (used >= guestDailyCredits) return false;
  guestBuckets.set(key, used + 1);
  return true;
}

function consumeWebSearch(context) {
  const key = `${todayKey()}:${context.senderNumber}`;
  const used = websearchBuckets.get(key) || 0;
  if (used >= websearchDailyLimit) return false;
  websearchBuckets.set(key, used + 1);
  return { ok: true, left: websearchDailyLimit - used - 1 };
}

async function sendReply(context, text) {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    await context.msg.reply(chunk);
  }
  await saveMessage(context, "assistant", chunks.join("\n"));
}

async function notifyMain(text) {
  if (!mainChatId()) {
    console.log(`[MAIN MISSING] ${text}`);
    return;
  }

  if (!client || !botReady) {
    console.log(`[MAIN QUEUE] ${text}`);
    return;
  }

  try {
    await client.sendMessage(mainChatId(), text);
  } catch (err) {
    console.error("MAIN notify fail:", err.message);
  }
}

async function notifyWebUntisDown(err) {
  const cooldownMs = Number(process.env.WEBUNTIS_NOTIFY_COOLDOWN_MS || 0);
  const now = Date.now();
  if (cooldownMs > 0 && now - lastUntisFailNotice < cooldownMs) return;
  lastUntisFailNotice = now;
  console.error("WebUntis fail:", err && err.message ? err.message : err);
  await notifyMain("WebUntis down Bruder, check Passwort");
}

async function saveMessage(context, role, content) {
  if (!supabase) return;
  const payload = {
    number: context.senderNumber || context.chatId,
    chat_id: context.chatId,
    role,
    content: String(content || "").slice(0, 12000),
    is_ephemeral: context.isEphemeral,
    expires_at: context.expiresAt.toISOString()
  };

  const { error } = await supabase.from("messages").insert(payload);
  if (!error) return;

  const fallback = {
    number: payload.number,
    role: payload.role,
    content: payload.content,
    expires_at: payload.expires_at
  };
  const retry = await supabase.from("messages").insert(fallback);
  if (retry.error) console.error("Supabase message insert fail:", retry.error.message);
}

async function loadMemory(context) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("number", context.senderNumber || context.chatId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Supabase memory load fail:", error.message);
    return [];
  }

  return (data || [])
    .reverse()
    .filter((row) => ["user", "assistant"].includes(row.role))
    .map((row) => ({ role: row.role, content: row.content }));
}

async function askGroq(context, userText) {
  if (!groq) return "Groq API fehlt in .env.";

  const memory = await loadMemory(context);
  const denkMode = /^denk\b|^denk[:\s-]/i.test(userText) || /\bdenkmodus\b/i.test(userText);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...memory,
    { role: "user", content: userText }
  ];

  const completion = await withTimeout(
    groq.chat.completions.create({
      model: process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile",
      messages,
      temperature: 0.35,
      max_tokens: 900
    }),
    denkMode ? denkTimeoutMs : aiTimeoutMs,
    "AI timeout"
  );

  return completion.choices?.[0]?.message?.content?.trim() || "Ich hab gerade keine Antwort bekommen.";
}

async function answerImage(context) {
  if (!groq) return "Groq API fehlt in .env.";
  const media = await context.msg.downloadMedia();
  if (!media || !media.data) return "Bild konnte ich nicht laden.";

  const question = context.body || "Beschreibe das Bild und beantworte, was wichtig ist.";
  const dataUrl = `data:${media.mimetype};base64,${media.data}`;
  const completion = await withTimeout(
    groq.chat.completions.create({
      model: process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Frage zum Bild: ${question}`
            },
            {
              type: "image_url",
              image_url: { url: dataUrl }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 700
    }),
    aiTimeoutMs,
    "Vision timeout"
  );

  return completion.choices?.[0]?.message?.content?.trim() || "Ich sehe das Bild, aber bekomme gerade keine Antwort.";
}

async function transcribeVoice(msg) {
  if (!groq || !toFile) return msg.body || "";
  const media = await msg.downloadMedia();
  if (!media || !media.data) return msg.body || "";

  const extension = media.mimetype.includes("mpeg")
    ? "mp3"
    : media.mimetype.includes("wav")
      ? "wav"
      : "ogg";
  const file = await toFile(Buffer.from(media.data, "base64"), `voice.${extension}`, {
    type: media.mimetype
  });

  const result = await withTimeout(
    groq.audio.transcriptions.create({
      file,
      model: process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo",
      language: "de",
      response_format: "json"
    }),
    aiTimeoutMs,
    "Voice timeout"
  );

  return result.text || "";
}

function createUntisClient() {
  if (!WebUntis) throw new Error("webuntis package fehlt");
  const school = process.env.WEBUNTIS_SCHOOL;
  const username = process.env.WEBUNTIS_USERNAME;
  const password = process.env.WEBUNTIS_PASSWORD;
  const url = process.env.WEBUNTIS_URL;
  if (!school || !username || !password || !url) throw new Error("WebUntis .env fehlt");
  return new WebUntis(school, username, password, url);
}

function untisDateTime(dateValue, timeValue) {
  const date = String(dateValue);
  const rawTime = String(timeValue || 0).padStart(4, "0");
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6)) - 1;
  const day = Number(date.slice(6, 8));
  const hour = Number(rawTime.slice(0, -2) || 0);
  const minute = Number(rawTime.slice(-2) || 0);
  return new Date(year, month, day, hour, minute, 0, 0);
}

function subjectText(entry) {
  const chunks = [];
  for (const key of ["su", "subjects"]) {
    if (Array.isArray(entry[key])) {
      for (const item of entry[key]) {
        chunks.push(item.name, item.longname, item.displayName);
      }
    }
  }
  return chunks.filter(Boolean).join(" ");
}

function looseMatch(a, b) {
  const clean = (x) =>
    String(x || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const left = clean(a);
  const right = clean(b);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

async function getNextLessonForSubject(fach) {
  const timeout = Number(process.env.WEBUNTIS_TIMEOUT_MS || 15000);
  const lookaheadDays = Number(process.env.WEBUNTIS_LOOKAHEAD_DAYS || 30);
  const untis = createUntisClient();

  try {
    await withTimeout(untis.login(), timeout, "WebUntis login timeout");
    const start = new Date();
    const end = addDays(start, lookaheadDays);
    const timetable = await withTimeout(
      untis.getOwnTimetableForRange(start, end),
      timeout,
      "WebUntis timetable timeout"
    );

    const now = new Date();
    const rows = (timetable || [])
      .map((entry) => ({
        entry,
        start: untisDateTime(entry.date, entry.startTime),
        subject: subjectText(entry)
      }))
      .filter((row) => row.start > now)
      .sort((a, b) => a.start - b.start);

    const match = rows.find((row) => looseMatch(row.subject, fach));
    if (!match) return null;

    const dayKey = match.start.toISOString().slice(0, 10);
    const dayTimes = [
      ...new Set(
        rows
          .filter((row) => row.start.toISOString().slice(0, 10) === dayKey)
          .map((row) => row.start.getTime())
      )
    ].sort((a, b) => a - b);

    return {
      fach,
      subject: match.subject || fach,
      start: match.start,
      periodNumber: Math.max(1, dayTimes.indexOf(match.start.getTime()) + 1)
    };
  } catch (err) {
    await notifyWebUntisDown(err);
    throw err;
  } finally {
    try {
      if (typeof untis.logout === "function") await untis.logout();
    } catch (_) {}
  }
}

async function checkWebUntisHealth() {
  const timeout = Number(process.env.WEBUNTIS_TIMEOUT_MS || 15000);
  const untis = createUntisClient();
  try {
    await withTimeout(untis.login(), timeout, "WebUntis login timeout");
    return { ok: true };
  } catch (err) {
    await notifyWebUntisDown(err);
    return { ok: false, error: err.message };
  } finally {
    try {
      if (typeof untis.logout === "function") await untis.logout();
    } catch (_) {}
  }
}

function formatDueDE(date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function relativeDayDE(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((target - today) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(date);
}

async function cleanupExpired() {
  if (!supabase) return { ok: true, deleted: null, skipped: "supabase fehlt" };
  const { error, count } = await supabase
    .from("messages")
    .delete({ count: "exact" })
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());
  if (error) throw error;
  return { ok: true, deleted: count };
}

async function backupSummary() {
  if (!supabase) return { ok: true, skipped: "supabase fehlt" };
  const [messages, homework] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("homework").select("id", { count: "exact", head: true })
  ]);
  if (messages.error) throw messages.error;
  if (homework.error) throw homework.error;
  const text = `Backup Check: messages=${messages.count || 0}, homework=${homework.count || 0}`;
  await notifyMain(text);
  return { ok: true, messages: messages.count || 0, homework: homework.count || 0 };
}

const helpers = {
  askGroq,
  consumeWebSearch,
  getNextLessonForSubject,
  formatDueDE,
  relativeDayDE,
  saveMessage,
  sendReply,
  notifyMain,
  isKilled: () => killed,
  setKilled: (value) => {
    killed = Boolean(value);
  }
};

app.get("/", (_, res) => {
  res.json({
    name: "Stack",
    ok: true,
    ready: botReady,
    killed,
    commands: commands.map((cmd) => cmd.file)
  });
});

app.get("/health", (_, res) => {
  res.json({ ok: true, ready: botReady, ts: new Date().toISOString() });
});

app.get("/qr", (_, res) => {
  res.json({ ready: botReady, qr: lastQr || null });
});

app.get("/cron/cleanup", async (req, res) => {
  if (!hasCronAccess(req)) return res.status(401).json({ ok: false });
  try {
    res.json(await cleanupExpired());
  } catch (err) {
    console.error("cleanup fail:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/cron/proactive", async (req, res) => {
  if (!hasCronAccess(req)) return res.status(401).json({ ok: false });
  const result = await checkWebUntisHealth();
  res.status(200).json(result);
});

app.get("/cron/backup", async (req, res) => {
  if (!hasCronAccess(req)) return res.status(401).json({ ok: false });
  try {
    res.json(await backupSummary());
  } catch (err) {
    console.error("backup fail:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function handleMessage(msg) {
  if (msg.from === "status@broadcast") return;

  let body = msg.body || "";
  const context = buildContext(msg, body);

  const isVoice = msg.hasMedia && ["audio", "ptt"].includes(msg.type);
  if (isVoice && !PREFIX_RE.test(body)) {
    if (!isAllowed(context)) return;
    try {
      body = await transcribeVoice(msg);
      context.rawBody = body;
    } catch (err) {
      console.error("voice fail:", err.message);
      return;
    }
  }

  if (!PREFIX_RE.test(body)) return;
  if (!isAllowed(context)) return;

  const commandBody = body.replace(PREFIX_RE, "").trim();
  context.body = commandBody;
  context.reply = (text) => sendReply(context, text);

  if (killed && !/^kill\b/i.test(commandBody)) {
    if (context.isMain) await msg.reply("Stack ist im Killswitch.");
    return;
  }

  if (!consumeRateLimit(context)) {
    await msg.reply("Kurz langsam King.");
    return;
  }

  if (!consumeGuestCredit(context)) {
    await msg.reply("Gast-Credits fuer heute leer. Morgen wieder.");
    return;
  }

  await saveMessage(context, "user", msg.hasMedia ? `[${msg.type}] ${commandBody}` : commandBody);

  if (msg.hasMedia && msg.type === "image") {
    const answer = await answerImage(context);
    await context.reply(answer);
    return;
  }

  for (const command of commands) {
    command.trigger.lastIndex = 0;
    if (command.trigger.test(commandBody)) {
      await command.execute(context);
      return;
    }
  }

  try {
    const answer = await askGroq(context, commandBody);
    await context.reply(answer);
  } catch (err) {
    console.error("AI fallback:", err.message);
    await context.reply("Mein Kopf hakt gerade. Versuch es gleich nochmal.");
  }
}

function startWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: "stack",
      dataPath: process.env.WWEBJS_AUTH_DIR || path.join(__dirname, ".wwebjs_auth")
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote"
      ]
    }
  });

  client.on("qr", (qr) => {
    lastQr = qr;
    console.log("QR:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    botReady = true;
    lastQr = "";
    console.log("Stack ist bereit.");
  });

  client.on("authenticated", () => console.log("WhatsApp authenticated."));
  client.on("auth_failure", (message) => console.error("WhatsApp auth_failure:", message));
  client.on("disconnected", (reason) => {
    botReady = false;
    console.error("WhatsApp disconnected:", reason);
  });

  client.on("message", (msg) => {
    handleMessage(msg).catch(async (err) => {
      console.error("message crash:", err);
      try {
        await msg.reply("Stack ist gestolpert. Ich laufe weiter.");
      } catch (_) {}
    });
  });

  client.initialize();
}

loadCommands();

app.listen(PORT, () => {
  console.log(`HTTP auf Port ${PORT}`);
  console.log(`WhatsApp Start in ${Math.round(startDelayMs / 1000)}s`);
  setTimeout(startWhatsApp, startDelayMs);
});

if (process.env.SELF_PING_URL) {
  setInterval(() => {
    fetch(process.env.SELF_PING_URL).catch(() => {});
  }, 30000).unref();
}

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
