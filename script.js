(function () {
  "use strict";

  var chatBody = document.querySelector(".chat-body");
  if (!chatBody) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = Array.prototype.slice.call(
    chatBody.querySelectorAll(".bubble, .step-label")
  );

  if (items.length === 0) return;

  if (reduceMotion) {
    // Skip the animated loop, but the .js class already hid every bubble
    // via CSS, so reveal them all at once instead of leaving it blank.
    items.forEach(function (el) {
      el.hidden = false;
      el.classList.add("msg-visible");
    });
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
  var timer = null;

  function wait(ms) {
    return new Promise(function (resolve) {
      timer = setTimeout(resolve, ms);
    });
  }

  function scrollToBottom() {
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
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

  // Pause the loop while the demo is scrolled off-screen so it doesn't
  // burn battery/CPU on a page people are no longer looking at.
  var section = document.getElementById("how-it-works");
  if (section && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
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
