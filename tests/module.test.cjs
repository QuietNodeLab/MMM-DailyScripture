const { test } = require("node:test");
const assert = require("node:assert/strict");
const { frontend, helper } = require("./support.cjs");

const { EventEmitter } = require("node:events");
function httpsMock(fail = false) {
  return {
    get(url, opts, cb) {
      const req = new EventEmitter();
      req.setTimeout = () => req;
      process.nextTick(() => {
        if (fail) {
          req.emit("error", Error("mock outage"));
          return;
        }
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = {};
        res.setEncoding = () => {};
        res.resume = () => {};
        cb(res);
        res.emit(
          "data",
          JSON.stringify({
            random_verse: {
              text: "A synthetic verse response for isolated testing.",
              book: "Sample",
              chapter: 1,
              verse: 1,
            },
          }),
        );
        res.emit("end");
      });
      return req;
    },
  };
}
async function response(h, config) {
  h.socketNotificationReceived("DAILYVERSE_REQUEST", {
    instanceId: "one",
    timezone: "UTC",
    ...config,
  });
  for (let i = 0; i < 30 && !h.sent; i++)
    await new Promise((r) => setImmediate(r));
  assert.ok(h.sent);
  return h.sent.p;
}
test("fresh standalone installation works without birthdays or another module", async () => {
  const h = helper({}, { https: httpsMock() });
  h.start();
  const p = await response(h, {});
  assert.equal(p.instanceId, "one");
  assert.equal(p.state.birthdayActive, false);
  assert.equal(p.state.verse.source, "bible-api.com");
});
test("API outages return an offline verse instead of hiding the module", async () => {
  const h = helper({}, { https: httpsMock(true) });
  h.start();
  const p = await response(h, {});
  assert.equal(p.state.birthdayActive, false);
  assert.equal(p.state.offline, true);
  assert.match(p.state.verse.version, /WEB/);
});
test("birthday suppression is opt-in and fails closed when opted-in data is absent", async () => {
  const h = helper({}, { https: httpsMock() });
  h.start();
  const p = await response(h, { hideOnBirthdays: true });
  assert.equal(p.state.birthdayActive, true);
});
test("IANA timezone validation and responses remain per instance", async () => {
  const h = helper({}, { https: httpsMock() });
  h.start();
  const p = await response(h, { timezone: "Bad/Zone" });
  assert.equal(p.instanceId, "one");
  assert.match(p.state.warning, /time zone/i);
  const m = frontend();
  m.socketNotificationReceived("DAILYVERSE_STATE", {
    instanceId: "other",
    state: { birthdayActive: true },
  });
  assert.equal(m.hidden, undefined);
});
test("client forwards provider and optional birthday settings", () => {
  const m = frontend({ provider: "web", hideOnBirthdays: false });
  m.start();
  assert.equal(m.sent.p.instanceId, "one");
  assert.equal(m.sent.p.provider, "web");
  assert.equal(m.sent.p.hideOnBirthdays, false);
  m.suspend();
});

test("valid same-day disk cache avoids network requests", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const h = helper(
    {
      "web.json": {
        day,
        verse: {
          text: "A synthetic cached verse for offline validation.",
          reference: "Sample 1:1",
          version: "TEST",
          source: "cache",
        },
      },
    },
    {
      https: {
        get() {
          throw Error("Unexpected network request");
        },
      },
    },
  );
  h.start();
  const p = await response(h, {});
  assert.equal(p.state.verse.source, "cache");
  assert.equal(p.state.offline, false);
});
test("concurrent requests keep instance identities separate", async () => {
  const h = helper({}, { https: httpsMock() });
  h.start();
  const received = [];
  h.sendSocketNotification = (n, p) => received.push(p);
  for (const id of ["first", "second"])
    h.socketNotificationReceived("DAILYVERSE_REQUEST", {
      instanceId: id,
      timezone: "UTC",
      provider: "web",
    });
  for (let i = 0; i < 30 && received.length < 2; i++)
    await new Promise((r) => setImmediate(r));
  assert.deepEqual(received.map((x) => x.instanceId).sort(), [
    "first",
    "second",
  ]);
  assert.equal(h.workers.size, 2);
});
