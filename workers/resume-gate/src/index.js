export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight — must come before method check
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Only accept POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const { name, email, "cf-turnstile-response": token } = payload;

    // Validate required fields
    if (!token) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    // Verify Turnstile token server-side
    const verifyResult = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
    if (!verifyResult.success) {
      return jsonResponse({ error: "Verification failed" }, 403);
    }

    // Forward to Formspree only if name/email provided (returning visitors send neither)
    if (name || email) {
      const formspreeUrl = env.FORMSPREE_URL;
      if (formspreeUrl) {
        ctx.waitUntil(
          fetch(formspreeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ name, email }),
          }).catch(() => {})
        );
      }
    }

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