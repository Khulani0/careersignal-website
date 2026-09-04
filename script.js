// How it works: scroll-linked chat demo. Scroll position through a tall
// track drives which of the 4 real stages is showing, both in the text
// panel and in the phone. Real conversation content, unchanged from the
// previous click-through version, just re-driven by scroll instead of
// timers or buttons.
(function () {
  "use strict";

  var track = document.getElementById("scrollyTrack");
  var chatBody = document.getElementById("scrollyChatBody");
  if (!track || !chatBody) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bubbles = Array.prototype.slice.call(chatBody.querySelectorAll("[data-stage]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".scrolly-panel"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".rail-dot"));
  var lines = Array.prototype.slice.call(document.querySelectorAll(".rail-line"));
  var totalStages = panels.length;

  if (reduceMotion) {
    // CSS drops the sticky/scroll-jacking mechanism and stacks every panel
    // in prefers-reduced-motion. Just reveal every bubble to match, once,
    // no scroll listener needed.
    bubbles.forEach(function (el) {
      el.hidden = false;
      el.classList.add("msg-visible");
    });
    return;
  }

  var currentStage = 0;

  function renderStage(stage) {
    if (stage === currentStage) return;
    currentStage = stage;

    bubbles.forEach(function (el) {
      var show = parseInt(el.getAttribute("data-stage"), 10) <= stage;
      el.hidden = !show;
      el.classList.toggle("msg-visible", show);
    });
    panels.forEach(function (el) {
      el.classList.toggle("active", parseInt(el.getAttribute("data-panel"), 10) === stage);
    });
    dots.forEach(function (el) {
      el.classList.toggle("active", parseInt(el.getAttribute("data-step"), 10) <= stage);
    });
    lines.forEach(function (el) {
      el.classList.toggle("filled", parseInt(el.getAttribute("data-step"), 10) < stage);
    });
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "auto" });
  }

  function updateScrolly() {
    var rect = track.getBoundingClientRect();
    var trackHeight = track.offsetHeight;
    var scrolled = -rect.top;
    var progress = scrolled / (trackHeight - window.innerHeight);
    progress = Math.max(0, Math.min(1, progress));
    var stage = Math.floor(progress * totalStages) + 1;
    stage = Math.max(1, Math.min(totalStages, stage));
    renderStage(stage);
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        updateScrolly();
        ticking = false;
      });
      ticking = true;
    }
  });
  updateScrolly();

  // Dots are a real, clickable way to jump for anyone not scrolling
  // through normally (keyboard nav, or just wanting to skip ahead).
  dots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      var stage = parseInt(dot.getAttribute("data-step"), 10);
      var trackTop = track.getBoundingClientRect().top + window.scrollY;
      var trackHeight = track.offsetHeight;
      var targetProgress = (stage - 0.5) / totalStages;
      var targetY = trackTop + targetProgress * (trackHeight - window.innerHeight);
      window.scrollTo({ top: targetY, behavior: "smooth" });
    });
  });
})();

// Template gallery: filter by tier and by photo-capable, client-side over
// the real rendered tiles already in the page (no content is generated or
// swapped in, only shown/hidden).
(function () {
  "use strict";

  var grid = document.getElementById("template-grid");
  if (!grid) return;

  var tiles = Array.prototype.slice.call(grid.querySelectorAll(".template-tile"));
  var emptyMsg = document.getElementById("template-empty");
  var tierButtons = Array.prototype.slice.call(document.querySelectorAll("[data-filter-tier]"));
  var photoButton = document.querySelector("[data-filter-photo]");

  var activeTier = "all";
  var photoOnly = false;

  function applyFilter() {
    var visibleCount = 0;
    tiles.forEach(function (tile) {
      var tiers = (tile.getAttribute("data-tiers") || "").split(" ");
      var isPhoto = tile.getAttribute("data-photo") === "true";
      var matchesTier = activeTier === "all" || tiers.indexOf(activeTier) !== -1;
      var matchesPhoto = !photoOnly || isPhoto;
      var show = matchesTier && matchesPhoto;
      tile.hidden = !show;
      if (show) visibleCount++;
    });
    if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
  }

  tierButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeTier = btn.getAttribute("data-filter-tier");
      tierButtons.forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      applyFilter();
    });
  });

  if (photoButton) {
    photoButton.addEventListener("click", function () {
      photoOnly = !photoOnly;
      photoButton.setAttribute("aria-pressed", photoOnly ? "true" : "false");
      applyFilter();
    });
  }

  // Pricing cards link here with a specific tier already in mind ("Choice
  // of 6 templates" etc). Pre-filter the grid to match instead of leaving
  // the visitor to re-select the tier they just read about.
  document.querySelectorAll(".tier-jump-link").forEach(function (link) {
    link.addEventListener("click", function () {
      var tier = link.getAttribute("data-jump-tier");
      var targetBtn = document.querySelector('[data-filter-tier="' + tier + '"]');
      if (targetBtn) targetBtn.click();
    });
  });
})();

// Pricing: expandable "what's this?" detail on specific feature lines.
(function () {
  "use strict";

  var toggles = document.querySelectorAll("[data-detail-toggle]");
  toggles.forEach(function (btn) {
    var detail = btn.nextElementSibling;
    if (!detail || !detail.classList.contains("feature-detail")) return;
    btn.addEventListener("click", function () {
      var isHidden = detail.hidden;
      detail.hidden = !isHidden;
      btn.textContent = isHidden ? "Hide" : "What's this?";
    });
  });
})();

// Bullet checker: runs entirely client-side against the real rules in
// tier1-ruleset.md Sections 2 (banned AI-tell phrases) and 5 (the ACE
// bullet framework: action-first, no redundant pronoun, quantify what's
// real). Nothing here is sent anywhere; it's a plain-text check in the
// browser.
(function () {
  "use strict";

  var input = document.getElementById("bulletInput");
  var resultsEl = document.getElementById("checkResults");
  var verdictEl = document.getElementById("verdictBox");
  if (!input || !resultsEl || !verdictEl) return;

  // tier1-ruleset.md Section 2, rule 2: the exact banned label-words,
  // unless the person's own words used them.
  var buzzwords = ["spearheaded", "leveraged", "dynamic", "results-driven", "passionate", "proven track record"];
  var weakOpeners = ["responsible for", "worked on", "helped with", "was in charge of", "duties included"];

  function runCheck() {
    var text = input.value.trim();
    var lower = text.toLowerCase();
    var rows = [];
    var failCount = 0;

    if (!text) {
      resultsEl.innerHTML = '<div class="check-row"><span class="check-mk info">&middot;</span><span>Type or paste a bullet to see the check.</span></div>';
      verdictEl.hidden = true;
      return;
    }

    // Section 5: "start with a verb showing what the person actually did"
    var openerHit = weakOpeners.filter(function (w) { return lower.indexOf(w) === 0; })[0];
    if (openerHit) {
      rows.push({ mk: "fail", text: 'Starts with "' + openerHit + '," not an action verb. Try opening with what you actually did.' });
      failCount++;
    } else {
      rows.push({ mk: "pass", text: "Opens with an action, not a weak phrase." });
    }

    // Section 5: "Avoid 'I' and 'we' inside bullets, the pronoun is redundant"
    var pronounHit = /\b(i|we)\b/i.test(text);
    if (pronounHit) {
      rows.push({ mk: "fail", text: 'Uses "I" or "we." The bullet format already implies first person, drop the pronoun.' });
      failCount++;
    } else {
      rows.push({ mk: "pass", text: "No redundant pronoun." });
    }

    // Section 2, rule 2: the exact banned-phrase list
    var buzzHit = buzzwords.filter(function (b) { return lower.indexOf(b) !== -1; });
    if (buzzHit.length) {
      rows.push({ mk: "fail", text: 'Uses an AI-tell phrase: "' + buzzHit[0] + '." Only keep it if it is genuinely your own word for the job.' });
      failCount++;
    } else {
      rows.push({ mk: "pass", text: "No banned buzzwords." });
    }

    // Section 5: "Quantify wherever real data exists"
    var hasNumber = /\d/.test(text);
    if (hasNumber) {
      rows.push({ mk: "pass", text: "Includes a real number, exactly what the ACE framework wants quantified." });
    } else {
      rows.push({ mk: "info", text: "No number yet. Add one only if it's real, never invent a statistic." });
    }

    resultsEl.innerHTML = rows.map(function (r) {
      var mkChar = r.mk === "pass" ? "✓" : r.mk === "fail" ? "✕" : "i";
      return '<div class="check-row"><span class="check-mk ' + r.mk + '">' + mkChar + "</span><span>" + r.text + "</span></div>";
    }).join("");

    verdictEl.hidden = false;
    if (failCount === 0) {
      verdictEl.className = "verdict good";
      verdictEl.textContent = "This bullet follows CareerSignal's writing rules.";
    } else {
      verdictEl.className = "verdict needs-work";
      verdictEl.textContent = failCount + (failCount > 1 ? " things" : " thing") + " to fix before this matches CareerSignal's standard.";
    }
  }

  input.addEventListener("input", runCheck);
  document.querySelectorAll(".try-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      input.value = chip.getAttribute("data-fill");
      runCheck();
      input.focus();
    });
  });
  runCheck();
})();

// Guide page: mistake/fix toggle under each rule. Plain class swap, one
// pair of panels per rule, nothing dynamic beyond show/hide.
(function () {
  "use strict";

  document.querySelectorAll("[data-rule-toggle]").forEach(function (toggle) {
    var buttons = toggle.querySelectorAll(".rule-toggle-btn");
    var panels = toggle.querySelectorAll(".rule-toggle-panel");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var show = btn.getAttribute("data-show");
        buttons.forEach(function (b) { b.classList.toggle("active", b === btn); });
        panels.forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== show;
        });
      });
    });
  });
})();

// Guide page: scroll-spy nav. Highlights whichever rule heading has most
// recently scrolled past a fixed line near the top of the viewport;
// clicking a nav entry is a plain anchor link, no JS needed for that part.
// A scroll-position sweep rather than IntersectionObserver's threshold/
// rootMargin tuning, since sections here are tall enough (toggle boxes
// included) that a narrow intersection band was skipping entries.
(function () {
  "use strict";

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".guide-nav a[data-spy]"));
  if (navLinks.length === 0) return;

  var targets = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);
  if (targets.length === 0) return;

  var LINE = 140; // px from viewport top counted as "current section"

  function update() {
    var active = targets[0];
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].el.getBoundingClientRect().top <= LINE) active = targets[i];
    }
    navLinks.forEach(function (l) { l.classList.toggle("active", l === active.link); });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        update();
        ticking = false;
      });
      ticking = true;
    }
  });
  update();
})();
