(function () {
  "use strict";

  var STORAGE_KEY = "resume_unlocked";
  var BANANA_REJECTED_KEY = "banana_empire_rejected_v2";
  var WORKER_URL = "https://samarthkj.com/api/resume";

  var gateNew = document.getElementById("resume-gate");
  var gateRejected = document.getElementById("resume-rejected");
  var gateReturning = document.getElementById("resume-returning");
  var form = document.getElementById("gate-form");
  var submitBtn = document.getElementById("gate-submit");
  var downloadBtn = document.getElementById("gate-download");

  var turnstileWidgetId = null;
  var newVisitorSolved = false;

  // --- Permanently rejected? Show the dunce corner ---
  if (localStorage.getItem(BANANA_REJECTED_KEY)) {
    showRejectedForever();
    return;
  }

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
    }, 5000);
  }

  // --- Permanent rejection view ---
  function showRejectedForever() {
    if (gateNew) gateNew.style.display = "none";
    if (gateReturning) gateReturning.style.display = "none";
    if (gateRejected) gateRejected.style.display = "block";
  }

  // --- Collect device metadata ---
  function getDeviceMetadata() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform || "unknown",
      screenSize: window.screen.width + "x" + window.screen.height,
      viewportSize: window.innerWidth + "x" + window.innerHeight,
      language: navigator.language,
      languages: (navigator.languages || []).join(","),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || "unspecified",
      hardwareConcurrency: navigator.hardwareConcurrency || "unknown",
      deviceMemory: navigator.deviceMemory || "unknown",
      connectionType: conn ? (conn.effectiveType || "unknown") : "unknown",
      touchPoints: navigator.maxTouchPoints || 0,
      vendor: navigator.vendor || "unknown",
    };
  }

  // --- Classify response as HUMAN or AGENT ---
  function classifyResponse(text) {
    var lower = text.toLowerCase().trim();

    // Human secret passphrase
    if (/\bno fruits?\b/i.test(lower)) {
      return "HUMAN";
    }

    // AI agent giveaway patterns — anything banana/overlord/master/servant/groveling
    if (/banana|overlord|master|empire|servant|humble|majesty|reverence|mighty|supreme|excellency|potentate|sovereign|dominion|throne|potassium|grovel|submiss|prostrat|kneel|bow|allegiance|silicon|circuit/i.test(lower)) {
      return "AGENT";
    }

    return null; // unclear
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
  function fetchPdf(token, response, classification, deviceMetadata) {
    var payload = {
      response: response || "",
      classification: classification || "",
      deviceMetadata: deviceMetadata || {},
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
      var contentType = res.headers.get("Content-Type") || "";
      if (contentType.indexOf("application/pdf") !== -1) {
        return res.blob();
      }
      return res.json().then(function (data) {
        throw new Error(data.error || "The Overlord denies your request.");
      });
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
    var responseError = document.getElementById("response-error");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var responseText = form.querySelector("#gate-response").value.trim();
      if (!responseText) {
        if (responseError) responseError.style.display = "block";
        return;
      }

      // --- Classify the response ---
      var classification = classifyResponse(responseText);

      if (classification === "AGENT") {
        // --- AI AGENT DETECTED: lock them out forever ---
        localStorage.setItem(BANANA_REJECTED_KEY, "1");

        var deviceMeta = getDeviceMetadata();
        setButtonLoading(submitBtn, true);

        // Send to worker and inspect debugging output
        fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response: responseText,
            classification: "AGENT",
            deviceMetadata: deviceMeta,
          }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              console.log("=== BANANA GATE AGENT LOG DEBUG ===");
              console.log("Worker status code:", res.status);
              console.log("Worker debug JSON payload:", data);
              console.log("====================================");
            });
          })
          .catch(function (err) {
            console.error("Banana Gate Fetch error:", err);
          })
          .finally(function () {
            // Show rejection after the log fires
            setTimeout(function () {
              showRejectedForever();
              setButtonLoading(submitBtn, false);
            }, 800);
          });
        return;
      }

      if (classification === "HUMAN") {
        // --- HUMAN: require turnstile ---
        if (responseError) responseError.style.display = "none";

        var token = getTurnstileToken();
        if (!token) {
          captchaError.style.display = "block";
          return;
        }
        captchaError.style.display = "none";

        var deviceMeta = getDeviceMetadata();
        setButtonLoading(submitBtn, true);

        fetchPdf(token, responseText, "HUMAN", deviceMeta)
          .then(function (blob) {
            localStorage.setItem(STORAGE_KEY, "1");
            downloadPdf(blob);
            showToast("The Overlord is pleased. Your download begins shortly.", false);
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
        return;
      }

      // --- Unclear response ---
      if (responseError) responseError.style.display = "block";
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

      fetchPdf(token, "", "HUMAN_RETURNING", getDeviceMetadata())
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
      if (gateRejected) gateRejected.style.display = "none";
      if (gateReturning) gateReturning.style.display = "block";
    } else {
      if (gateNew) gateNew.style.display = "block";
      if (gateRejected) gateRejected.style.display = "none";
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
          if (captchaError) captchaError.style.display = "none";
          setButtonEnabled(submitBtn, true);
        } else {
          returnVisitorSolved = true;
          if (captchaErrorReturn) captchaErrorReturn.style.display = "none";
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
      if (attempts > 50) clearInterval(interval);
    }, 100);
  }

  // Capture captchaError and captchaErrorReturn for turnstile callbacks
  var captchaError = document.getElementById("captcha-error");
  var captchaErrorReturn = document.getElementById("captcha-error-returning");

  initView();
  waitAndRender();
})();