/* MMM-DailyScripture — frosted-glass daily Scripture card.
   Optional birthday-aware hiding uses bundled date logic; no companion module is required. */
Module.register("MMM-DailyScripture", {
  defaults: {
    refreshInterval: 10 * 60 * 1000,
    birthdayFile: "birthdays.json",
    hideOnBirthdays: false,
    provider: "web",
    timezone: null,
    birthdayShowFromHour: 0,
    birthdayShowUntilHour: 24,
    // For checking the appearance without waiting for a non-birthday day:
    preview: false,
  },

  getStyles: function () {
    return [this.file("MMM-DailyScripture.css")];
  },

  start: function () {
    this.verseState = null;
    this.birthdayActive = false;
    this.hiddenByBirthday = false;
    this.requestVerse();
    var self = this;
    this.refreshTimer = setInterval(function () {
      self.requestVerse();
    }, this.config.refreshInterval);
  },

  suspend: function () {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  resume: function () {
    this.requestVerse();
    if (!this.refreshTimer) {
      var self = this;
      this.refreshTimer = setInterval(function () {
        self.requestVerse();
      }, this.config.refreshInterval);
    }
  },

  requestVerse: function () {
    this.sendSocketNotification("DAILYVERSE_REQUEST", {
      instanceId: this.identifier,
      birthdayFile: this.config.birthdayFile,
      hideOnBirthdays: this.config.hideOnBirthdays,
      provider: this.config.provider,
      timezone:
        this.config.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      birthdayShowFromHour: this.config.birthdayShowFromHour,
      birthdayShowUntilHour: this.config.birthdayShowUntilHour,
      preview: this.config.preview,
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (
      notification !== "DAILYVERSE_STATE" ||
      !payload ||
      payload.instanceId !== this.identifier
    ) {
      return;
    }
    this.verseState = payload.state || null;
    payload = payload.state;
    this.birthdayActive = Boolean(payload && payload.birthdayActive);

    // Hide our entire MagicMirror module on birthdays, not just the card:
    // this removes the otherwise empty margin above Countdown.
    if (this.birthdayActive) {
      this.hiddenByBirthday = true;
      this.hide(0);
    } else {
      this.hiddenByBirthday = false;
      this.show(0);
      this.updateDom(0);
    }
  },

  element: function (tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text !== undefined && text !== null) {
      el.textContent = String(text);
    }
    return el;
  },

  getDom: function () {
    var root = this.element("div", "dv-root");
    if (this.birthdayActive) {
      return root;
    }

    var state = this.verseState;
    var verse = state && state.verse;
    var card = this.element("article", "dv-card");

    var head = this.element("div", "dv-header");
    var symbol = this.element("span", "dv-symbol");
    symbol.innerHTML =
      '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 8c-4.6-3.1-9.1-3.1-13-1.7v18.9c4.5-1.2 9.2-.7 13 2.3m0-19.5c4.6-3.1 9.1-3.1 13-1.7v18.9c-4.5-1.2-9.2-.7-13 2.3M16 8v19.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    head.appendChild(symbol);
    head.appendChild(this.element("span", "dv-heading", "VERSE OF THE DAY"));
    head.appendChild(
      this.element("span", "dv-date", (state && state.dateLabel) || ""),
    );
    card.appendChild(head);

    if (!verse) {
      card.appendChild(
        this.element("p", "dv-text dv-loading", "Loading today's verse…"),
      );
    } else {
      var content = String(verse.text || "").trim();
      var sizeClass =
        content.length > 215
          ? " dv-text--long"
          : content.length > 150
            ? " dv-text--medium"
            : "";
      card.appendChild(
        this.element(
          "p",
          "dv-text" + sizeClass,
          "“" + content.replace(/[“”]/g, "") + "”",
        ),
      );
      var foot = this.element("div", "dv-footer");
      foot.appendChild(
        this.element("span", "dv-reference", verse.reference || ""),
      );
      var source = verse.version ? verse.version : "";
      if (state && state.offline) {
        source = (source ? source + " · " : "") + "saved verse";
      }
      foot.appendChild(this.element("span", "dv-version", source));
      card.appendChild(foot);
    }
    root.appendChild(card);
    return root;
  },
});
