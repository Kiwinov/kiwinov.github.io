---
permalink: /resume/
title: "Resume"
layout: single
author_profile: false
---

<div id="resume-gate">
  <div class="gate-container">
    <h2>Access Resume</h2>
    <p class="gate-subtitle">Enter your details to download my resume.</p>

    <form id="gate-form">
      <div class="form-group">
        <label for="gate-name">Full Name <span class="required">*</span></label>
        <input type="text" id="gate-name" name="name" required placeholder="Your name" autocomplete="name">
      </div>

      <div class="form-group">
        <label for="gate-email">Email <span class="required">*</span></label>
        <input type="email" id="gate-email" name="email" required placeholder="you@example.com" autocomplete="email">
        <div class="field-error" id="email-error">Please enter a valid email address.</div>
      </div>

      <div class="form-group captcha-group">
        <div id="turnstile-new" data-sitekey="{{ site.turnstile_site_key }}" data-theme="auto"></div>
        <div class="field-error" id="captcha-error">Please complete the verification.</div>
      </div>

      <button type="submit" id="gate-submit" class="btn btn--primary" disabled>Download Resume</button>
    </form>
  </div>
</div>

<div id="resume-returning" style="display: none;">
  <div class="gate-container">
    <h2>Welcome Back</h2>
    <p class="gate-subtitle">Complete the verification to download the resume.</p>

    <div class="form-group captcha-group">
      <div id="turnstile-return" data-sitekey="{{ site.turnstile_site_key }}" data-theme="auto"></div>
      <div class="field-error" id="captcha-error-returning">Please complete the verification.</div>
    </div>

    <button type="button" id="gate-download" class="btn btn--primary" disabled>Download Resume</button>
  </div>
</div>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<link rel="stylesheet" href="/assets/css/resume-gate.css">
<script src="/assets/js/resume-gate.js"></script>