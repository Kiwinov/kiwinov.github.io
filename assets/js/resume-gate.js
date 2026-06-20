(function () {
  "use strict";

  var STORAGE_KEY = "resume_unlocked";
  var WORKER_URL = "https://samarthkj.com/api/resume";

  var gateNew = document.getElementById("resume-gate");
  var gateReturning = document.getElementById("resume-returning");
  var form = document.getElementById("gate-form");
  var submitBtn = document.getElementById("gate-submit");
  var downloadBtn = document.getElementById("gate-download");

  var turnstileWidgetId = null;

  // --- Toast ---
  function showToast(message, isError) {
    var existing = document.querySelector(".gate-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "gate-toast" + (isError ? " error" : "");
    toast.textContent = message;
    document.body.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add("visible");

    setTimeout(function () {
      toast.classList.remove("visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 4000);
  }

  // --- Trigger PDF download from blob ---
  function downloadPdf(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Samarth_KJ_Resume.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // --- Fetch PDF from Worker ---
  function fetchPdf(token, name, email) {
    var payload = {
      name: name || "",
      email: email || "",
      "cf-turnstile-response": token,
    };

    return fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.error || "Request failed");
        });
      }
      return res.blob();
    });
  }

  // --- Get the current turnstile token ---
  function getTurnstileToken() {
    if (!window.turnstile || turnstileWidgetId === null) return null;
    return window.turnstile.getResponse(turnstileWidgetId);
  }

  // --- Reset turnstile ---
  function resetTurnstile() {
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  // --- Disable/enable button ---
  function setButtonEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add("loading");
      btn.disabled = true;
    } else {
      btn.classList.remove("loading");
    }
  }

  // --- New visitor form submit ---
  if (form) {
    var captchaError = document.getElementById("captcha-error");
    var newVisitorSolved = false;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var token = getTurnstileToken();
      if (!token) {
        captchaError.style.display = "block";
        return;
      }

      var name = form.querySelector("#gate-name").value.trim();
      var email = form.querySelector("#gate-email").value.trim();

      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById("email-error").style.display = "block";
        return;
      }
      document.getElementById("email-error").style.display = "none";

      setButtonLoading(submitBtn, true);

      fetchPdf(token, name, email)
        .then(function (blob) {
          localStorage.setItem(STORAGE_KEY, "1");
          downloadPdf(blob);
          showToast("Thanks! Your download should start shortly.", false);
          setButtonLoading(submitBtn, false);
        })
        .catch(function (err) {
          console.error("Gate error:", err);
          showToast(err.message || "Something went wrong. Please try again.", true);
          setButtonLoading(submitBtn, false);
          resetTurnstile();
          newVisitorSolved = false;
          setButtonEnabled(submitBtn, false);
        });
    });
  }

  // --- Returning visitor download click ---
  if (downloadBtn) {
    var captchaErrorReturn = document.getElementById("captcha-error-returning");
    var returnVisitorSolved = false;

    downloadBtn.addEventListener("click", function () {
      var token = getTurnstileToken();
      if (!token) {
        captchaErrorReturn.style.display = "block";
        return;
      }

      setButtonLoading(downloadBtn, true);

      fetchPdf(token, "", "")
        .then(function (blob) {
          downloadPdf(blob);
          setButtonLoading(downloadBtn, false);
        })
        .catch(function (err) {
          console.error("Gate error:", err);
          showToast(err.message || "Something went wrong. Please try again.", true);
          setButtonLoading(downloadBtn, false);
          resetTurnstile();
          returnVisitorSolved = false;
          setButtonEnabled(downloadBtn, false);
        });
    });
  }

  // --- Init: show correct view, then render Turnstile ---
  function initView() {
    if (localStorage.getItem(STORAGE_KEY)) {
      if (gateNew) gateNew.style.display = "none";
      if (gateReturning) gateReturning.style.display = "block";
    } else {
      if (gateNew) gateNew.style.display = "block";
      if (gateReturning) gateReturning.style.display = "none";
    }
  }

  // --- Render Turnstile on the visible container ---
  function renderTurnstile() {
    var isReturning = localStorage.getItem(STORAGE_KEY);
    var container = isReturning
      ? document.getElementById("turnstile-return")
      : document.getElementById("turnstile-new");

    if (!container || !window.turnstile) return;

    var isNew = !isReturning;

    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: container.getAttribute("data-sitekey"),
      theme: container.getAttribute("data-theme") || "auto",
      callback: function () {
        if (isNew) {
          newVisitorSolved = true;
          captchaError.style.display = "none";
          setButtonEnabled(submitBtn, true);
        } else {
          returnVisitorSolved = true;
          captchaErrorReturn.style.display = "none";
          setButtonEnabled(downloadBtn, true);
        }
      },
      "expired-callback": function () {
        if (isNew) {
          newVisitorSolved = false;
          setButtonEnabled(submitBtn, false);
        } else {
          returnVisitorSolved = false;
          setButtonEnabled(downloadBtn, false);
        }
      },
    });
  }

  // --- Wait for Turnstile API, then render ---
  function waitAndRender() {
    if (window.turnstile) {
      renderTurnstile();
      return;
    }
    var attempts = 0;
    var interval = setInterval(function () {
      if (window.turnstile) {
        clearInterval(interval);
        renderTurnstile();
      }
      attempts++;
      if (attempts > 50) clearInterval(interval); // 5s timeout
    }, 100);
  }

  initView();
  waitAndRender();
})();