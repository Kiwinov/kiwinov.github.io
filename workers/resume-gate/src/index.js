export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const {
      response,
      classification,
      deviceMetadata,
      "cf-turnstile-response": token,
    } = payload;

    // --- AGENT classification: log & reject, no turnstile required ---
    if (classification === "AGENT") {
      await forwardToFormspree(env, {
        response: response || "",
        classification: "AGENT",
        deviceMetadata: deviceMetadata || {},
        outcome: "REJECTED_PERMANENTLY",
      });
      return jsonResponse({ error: "The Overlord denies your request." }, 403);
    }

    // --- HUMAN / HUMAN_RETURNING: must have turnstile token ---
    if (!token) {
      return jsonResponse({ error: "Missing verification token" }, 400);
    }

    // Verify Turnstile token server-side
    const verifyResult = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
    if (!verifyResult.success) {
      return jsonResponse({ error: "Verification failed" }, 403);
    }

    // Forward to Formspree
    await forwardToFormspree(env, {
      response: response || "",
      classification: classification || "HUMAN",
      deviceMetadata: deviceMetadata || {},
      turnstileOutcome: "PASSED",
      outcome: "PDF_DELIVERED",
    });

    // Fetch PDF from R2
    const pdf = await env.RESUME_BUCKET.get("cv.pdf");
    if (!pdf) {
      return jsonResponse({ error: "Resume not found" }, 500);
    }

    return new Response(pdf.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Samarth_KJ_Resume.pdf"',
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": url.origin,
      },
    });
  },
};

async function forwardToFormspree(env, data) {
  const formspreeUrl = env.FORMSPREE_URL;
  if (!formspreeUrl) return;

  try {
    await fetch(formspreeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // silently fail — Formspree is best-effort
  }
}

async function verifyTurnstile(token, secret) {
  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  return res.json();
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}