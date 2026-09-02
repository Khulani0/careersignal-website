(function () {
  "use strict";

  var chatBody = document.querySelector(".chat-body");
  if (!chatBody) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = Array.prototype.slice.call(
    chatBody.querySelectorAll(".bubble, .step-label")
  );

  var controls = document.querySelector(".chat-controls");

  if (items.length === 0) return;

  if (reduceMotion) {
    // Skip the animated loop, but the .js class already hid every bubble
    // via CSS, so reveal them all at once instead of leaving it blank.
    items.forEach(function (el) {
      el.hidden = false;
      el.classList.add("msg-visible");
    });
    // Nothing to step through when everything's already shown at once.
    if (controls) controls.hidden = true;
    return;
  }

  var TYPING_MS = 850;
  var AFTER_IN_MS = 450;
  var SEND_DELAY_MS = 300;
  var AFTER_OUT_MS = 450;
  var STEP_MS = 550;
  var LOOP_PAUSE_MS = 2200;

  var typingBubble = document.createElement("div");
  typingBubble.className = "bubble bubble-in bubble-typing";
  typingBubble.setAttribute("aria-hidden", "true");
  typingBubble.innerHTML =
    '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

  var running = true;
  var manual = false;
  var timer = null;

  // Index (within `items`) of each of the 4 real stages, keyed by the
  // .step-label that marks the end of that stage.
  var stageEndIndex = items.reduce(function (acc, el, i) {
    if (el.classList.contains("step-label")) acc.push(i);
    return acc;
  }, []);
  var currentStage = 0;

  function wait(ms) {
    return new Promise(function (resolve) {
      timer = setTimeout(resolve, ms);
    });
  }

  function scrollToBottom(instant) {
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: instant ? "auto" : "smooth" });
  }

  function showTyping() {
    typingBubble.classList.add("msg-visible");
    chatBody.appendChild(typingBubble);
    scrollToBottom();
    return wait(TYPING_MS);
  }

  function hideTyping() {
    if (typingBubble.parentNode) typingBubble.parentNode.removeChild(typingBubble);
  }

  function reveal(el) {
    el.hidden = false;
    scrollToBottom();
    // Two rAFs so the browser commits the un-hidden (opacity: 0) frame
    // before the class flips, otherwise the fade-in transition is skipped.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add("msg-visible");
      });
    });
  }

  function reset() {
    items.forEach(function (el) {
      el.classList.remove("msg-visible");
      el.hidden = true;
    });
    chatBody.scrollTo({ top: 0, behavior: "auto" });
  }

  async function playOnce() {
    for (var i = 0; i < items.length; i++) {
      if (!running) return;
      var el = items[i];

      if (el.classList.contains("bubble-in")) {
        await showTyping();
        if (!running) return;
        hideTyping();
        reveal(el);
        await wait(AFTER_IN_MS);
      } else if (el.classList.contains("bubble-out")) {
        await wait(SEND_DELAY_MS);
        if (!running) return;
        reveal(el);
        await wait(AFTER_OUT_MS);
      } else {
        reveal(el);
        await wait(STEP_MS);
      }
    }
  }

  async function loop() {
    while (running) {
      reset();
      await wait(120);
      await playOnce();
      if (!running) return;
      await wait(LOOP_PAUSE_MS);
    }
  }

  // ---- Manual step-through controls ----
  function updateControlsState() {
    if (!controls) return;
    var prevBtn = document.getElementById("chat-prev");
    var nextBtn = document.getElementById("chat-next");
    if (prevBtn) prevBtn.disabled = currentStage <= 1;
    if (nextBtn) nextBtn.disabled = currentStage >= stageEndIndex.length;
    controls.querySelectorAll(".step-dot").forEach(function (dot) {
      var stage = parseInt(dot.getAttribute("data-step"), 10);
      dot.setAttribute("aria-current", stage === currentStage ? "true" : "false");
    });
  }

  function goToStage(stage) {
    stage = Math.max(1, Math.min(stageEndIndex.length, stage));
    if (!manual) {
      manual = true;
      running = false;
      hideTyping();
      if (timer) clearTimeout(timer);
    }
    currentStage = stage;
    var endIndex = stageEndIndex[stage - 1];
    reset();
    for (var i = 0; i <= endIndex; i++) {
      items[i].hidden = false;
      items[i].classList.add("msg-visible");
    }
    scrollToBottom(true);
    updateControlsState();
  }

  if (controls) {
    var prevBtn = document.getElementById("chat-prev");
    var nextBtn = document.getElementById("chat-next");
    if (prevBtn) prevBtn.addEventListener("click", function () { goToStage(currentStage - 1 || 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goToStage((currentStage || 0) + 1); });
    controls.querySelectorAll(".step-dot").forEach(function (dot) {
      dot.addEventListener("click", function () {
        goToStage(parseInt(dot.getAttribute("data-step"), 10));
      });
    });
    updateControlsState();
  }

  // Pause the loop while the demo is scrolled off-screen so it doesn't
  // burn battery/CPU on a page people are no longer looking at. Once the
  // visitor has taken manual control, leave it alone rather than
  // resuming autoplay underneath them.
  var section = document.getElementById("how-it-works");
  if (section && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (manual) return;
          if (entry.isIntersecting && !running) {
            running = true;
            loop();
          } else if (!entry.isIntersecting && running) {
            running = false;
            hideTyping();
            if (timer) clearTimeout(timer);
          }
        });
      },
      { threshold: 0.15 }
    );
    running = false;
    observer.observe(section);
  } else {
    loop();
  }
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
