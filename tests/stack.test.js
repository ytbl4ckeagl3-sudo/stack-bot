const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");

test("package.json has required scripts and dependencies", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts.start, "node index.js");
  assert.equal(pkg.scripts.postinstall, "node scripts/install-chrome.js");
  assert.match(pkg.scripts.check, /node --check index\.js/);
  assert.ok(pkg.dependencies["@tavily/core"]);
  assert.ok(pkg.dependencies.puppeteer);
  assert.ok(pkg.dependencies.qrcode);
  assert.ok(pkg.dependencies["whatsapp-web.js"]);
  assert.ok(pkg.dependencies["webuntis"]);
});

test("commands export RegExp triggers and execute functions", () => {
  const commandDir = path.join(root, "commands");
  const files = fs.readdirSync(commandDir).filter((file) => file.endsWith(".js"));
  assert.deepEqual(files.sort(), ["hausaufgabe.js", "help.js", "kill.js", "ping.js", "suche.js"]);

  for (const file of files) {
    const command = require(path.join(commandDir, file));
    assert.ok(command.trigger instanceof RegExp, `${file} trigger`);
    assert.equal(typeof command.execute, "function", `${file} execute`);
  }
});

test("typo-tolerant Stack prefix is present", () => {
  const index = fs.readFileSync(path.join(root, "index.js"), "utf8");
  assert.match(index, /Stack\|Stak\|Stacck\|Stakk/);
  assert.match(index, /Antworte IMMER auf Deutsch/);
  assert.match(index, /GROQ_VISION_MODEL/);
  assert.match(index, /\/qr\.html/);
});

test("supabase schema contains memory expiry and homework table", () => {
  const sql = fs.readFileSync(path.join(root, "supabase.sql"), "utf8").toLowerCase();
  assert.match(sql, /alter table messages add column if not exists expires_at timestamptz/);
  assert.match(sql, /create table if not exists homework/);
  assert.match(sql, /fach text/);
  assert.match(sql, /aufgabe text/);
  assert.match(sql, /due timestamptz/);
  assert.match(sql, /done bool/);
});

test("hausaufgabe command saves parsed homework and chooses later response", async () => {
  const command = require(path.join(root, "commands", "hausaufgabe.js"));
  const due = new Date(Date.now() + 72 * 60 * 60 * 1000);
  let inserted = null;
  let reply = "";

  await command.execute({
    body: "HA: Mathe S.45 Nr.3, heute in Stunde gemacht: Gleichungen",
    senderNumber: "491701234567",
    supabase: {
      from: (table) => ({
        insert: async (payload) => {
          inserted = { table, payload };
          return { error: null };
        }
      })
    },
    helpers: {
      getNextLessonForSubject: async (fach) => ({ fach, start: due, periodNumber: 1 }),
      formatDueDE: () => "Mittwoch 08:00",
      relativeDayDE: () => "Mittwoch"
    },
    reply: async (text) => {
      reply = text;
    }
  });

  assert.equal(inserted.table, "homework");
  assert.equal(inserted.payload.fach, "Mathe");
  assert.equal(inserted.payload.aufgabe, "S.45 Nr.3");
  assert.match(reply, /Mach spaeter King/);
});

test("kill command only allows MAIN_NUMBER context", async () => {
  const command = require(path.join(root, "commands", "kill.js"));
  let killed = false;
  let reply = "";

  await command.execute({
    isMain: true,
    body: "kill on",
    helpers: {
      setKilled: (value) => {
        killed = value;
      },
      isKilled: () => killed
    },
    reply: async (text) => {
      reply = text;
    }
  });

  assert.equal(killed, true);
  assert.equal(reply, "Killswitch an.");
});

test("http runtime starts and answers /health without starting WhatsApp immediately", async () => {
  const port = 34000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["index.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      START_DELAY_MS: "600000",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      GROQ_API_KEY: "",
      TAVILY_API_KEY: ""
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    const deadline = Date.now() + 12000;
    let data = null;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        data = await response.json();
        break;
      } catch (_) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    assert.deepEqual(data && data.ok, true, output);
    assert.equal(data.ready, false);
  } finally {
    child.kill("SIGTERM");
  }
});
