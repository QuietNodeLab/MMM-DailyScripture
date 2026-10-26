/* Configurable WEB/daily scripture helper with bundled birthday logic and local cache. */
const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const https = require("https");

const FALLBACK = {
  text: "Yahweh is my shepherd: I shall lack nothing.",
  reference: "Psalm 23:1",
  version: "WEB · offline",
  source: "World English Bible (public domain)",
};

function localParts(timezone) {
  const zone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = {};
  parts.forEach((p) => {
    if (p.type !== "literal") values[p.type] = Number(p.value);
  });
  const day = [
    values.year,
    String(values.month).padStart(2, "0"),
    String(values.day).padStart(2, "0"),
  ].join("-");
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
  }).format(new Date());
  return { ...values, dayKey: day, dateLabel };
}

function getJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "MagicMirror-DailyVerse/1.0",
        },
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirects < 2
        ) {
          res.resume();
          const next = new URL(res.headers.location, url);
          if (
            next.protocol !== "https:" ||
            !["beta.ourmanna.com", "bible-api.com"].includes(next.hostname)
          ) {
            reject(new Error("Unapproved redirect host"));
            return;
          }
          getJson(next.toString(), redirects + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > 65536)
            res.destroy(new Error("API response too large"));
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(9000, () =>
      req.destroy(new Error("Weather-independent verse API timed out")),
    );
    req.on("error", reject);
  });
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function validVerse(verse) {
  return Boolean(
    verse &&
    verse.text &&
    verse.reference &&
    verse.text.length <= 260 &&
    verse.text.length >= 12,
  );
}

async function fromOurManna() {
  const data = await getJson(
    "https://beta.ourmanna.com/api/v1/get?format=json&order=daily",
  );
  const d = data && data.verse && data.verse.details;
  if (!d) throw new Error("Daily verse missing in response");
  const v = {
    text: cleanText(d.text),
    reference: cleanText(d.reference),
    version: (cleanText(d.version) || "Bible") + " · OurManna",
    source: "OurManna",
  };
  if (!validVerse(v))
    throw new Error("Daily verse too long or invalid for card");
  return v;
}

async function fromBibleAPI() {
  for (let i = 0; i < 4; i++) {
    const data = await getJson(
      "https://bible-api.com/data/web/random/PSA,PRO,JHN,ROM,PHP,ISA,MAT,LUK",
    );
    const r = data && data.random_verse;
    if (!r) throw new Error("Random verse missing from response");
    const verse = {
      text: cleanText(r.text),
      reference: cleanText(r.book + " " + r.chapter + ":" + r.verse),
      version: "WEB · bible-api.com",
      source: "bible-api.com",
    };
    if (validVerse(verse)) return verse;
  }
  throw new Error("No short verse returned");
}

const worker = {
  initialize(config) {
    this.pending = null;
    this.lastAttemptAt = 0;
    this.currentInMemory = null;
    this.provider = config.provider === "ourmanna" ? "ourmanna" : "web";
    this.cacheFile = path.join(this.cacheDirectory, this.provider + ".json");
    this.birthdayLogic = require("./birthday-logic.js");
  },

  birthdayIsActive(config, parts) {
    if (!config.hideOnBirthdays || config.preview) return false;
    const file = path.basename(String(config.birthdayFile || "birthdays.json"));
    const filepath = path.join(global.root_path, "config", file);
    try {
      if (!this.birthdayLogic) throw new Error("Birthday logic unavailable");
      const contents = JSON.parse(fs.readFileSync(filepath, "utf8"));
      const people = this.birthdayLogic.normalize(contents);
      const hour = parts.hour % 24;
      const start = Number(
        config.birthdayShowFromHour == null ? 0 : config.birthdayShowFromHour,
      );
      const end = Number(
        config.birthdayShowUntilHour == null
          ? 24
          : config.birthdayShowUntilHour,
      );
      if (!(hour >= start && hour < end)) return false;
      return (
        this.birthdayLogic.onDay(people, parts.year, parts.month, parts.day)
          .length > 0
      );
    } catch (error) {
      console.error(
        "MMM-DailyScripture: cannot verify birthdays.json; hiding verse to avoid overlap:",
        error.message,
      );
      return true;
    }
  },

  readCache() {
    try {
      const d = JSON.parse(fs.readFileSync(this.cacheFile, "utf8"));
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.day) && validVerse(d.verse))
        return d;
    } catch (error) {
      // No cache exists on first run, or a previous write was interrupted.
    }
    return null;
  },

  saveCache(day, verse) {
    try {
      fs.mkdirSync(this.cacheDirectory, { recursive: true });
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify({ day, verse }, null, 2) + "\n",
        "utf8",
      );
    } catch (error) {
      console.warn(
        "MMM-DailyScripture: could not write persistent verse cache:",
        error.message,
      );
    }
  },

  async freshVerse(day) {
    const onDisk = this.readCache();
    if (onDisk && onDisk.day === day)
      return { verse: onDisk.verse, offline: false };
    if (this.currentInMemory && this.currentInMemory.day === day) {
      return { verse: this.currentInMemory.verse, offline: false };
    }
    if (this.pending) return this.pending;
    if (Date.now() - this.lastAttemptAt < 30 * 60 * 1000) {
      return { verse: (onDisk && onDisk.verse) || FALLBACK, offline: true };
    }
    this.lastAttemptAt = Date.now();
    this.pending = (async () => {
      let verse = null;
      try {
        verse = await (this.provider === "ourmanna"
          ? fromOurManna()
          : fromBibleAPI());
      } catch (error) {
        console.warn(
          "MMM-DailyScripture: verse API unavailable:",
          error.message,
        );
        try {
          if (this.provider === "ourmanna") verse = await fromBibleAPI();
        } catch (other) {
          console.warn(
            "MMM-DailyScripture: backup API unavailable:",
            other.message,
          );
        }
      }
      if (verse) {
        this.currentInMemory = { day, verse };
        this.saveCache(day, verse);
        return { verse, offline: false };
      }
      return { verse: (onDisk && onDisk.verse) || FALLBACK, offline: true };
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  },

  async getState(config) {
    const parts = localParts(config.timezone);
    const birthdayActive = this.birthdayIsActive(config, parts);
    if (birthdayActive) return { birthdayActive: true, day: parts.dayKey };
    const chosen = await this.freshVerse(parts.dayKey);
    return {
      birthdayActive: false,
      day: parts.dayKey,
      dateLabel: parts.dateLabel,
      verse: chosen.verse,
      offline: chosen.offline,
    };
  },
};

module.exports = NodeHelper.create({
  start() {
    this.workers = new Map();
  },
  socketNotificationReceived(notification, config) {
    if (
      notification !== "DAILYVERSE_REQUEST" ||
      !config ||
      typeof config.instanceId !== "string"
    )
      return;
    this.workers ||= new Map();
    const key = JSON.stringify([
      config.instanceId,
      config.provider,
      config.timezone,
    ]);
    let state = this.workers.get(key);
    if (!state) {
      state = Object.assign({}, worker, {
        cacheDirectory: path.join(__dirname, "cache"),
      });
      state.initialize(config);
      this.workers.set(key, state);
    }
    state
      .getState(config)
      .then((result) =>
        this.sendSocketNotification("DAILYVERSE_STATE", {
          instanceId: config.instanceId,
          state: result,
        }),
      )
      .catch((error) => {
        this.sendSocketNotification("DAILYVERSE_STATE", {
          instanceId: config.instanceId,
          state: {
            birthdayActive: Boolean(config.hideOnBirthdays),
            warning: error.message,
            offline: true,
            verse: FALLBACK,
          },
        });
      });
  },
});
