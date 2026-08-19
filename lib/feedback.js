// Feedback form: validation and email delivery via Resend.
//
// The destination address is read from the DEVELOPER_EMAIL environment
// secret and the API key from RESEND_API_KEY — nothing is hardcoded here.
// If the provider is not configured the call fails gracefully with a clear
// message instead of pretending the email was sent.

export const FEEDBACK_CATEGORIES = [
  "Issue",
  "Missing feature",
  "Expectation",
  "Conversion problem",
  "Other"
];
export const MAX_NOTE = 2000;
export const MAX_NAME = 80;
export const MAX_EMAIL = 254;

export function validateFeedback({ name, email, category, note } = {}) {
  const cleanName = String(name ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  if (!cleanName) return { error: "Name is required." };

  const cleanEmail = String(email ?? "").trim().toLowerCase().slice(0, MAX_EMAIL);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { error: "A valid email address is required." };
  }

  if (!FEEDBACK_CATEGORIES.includes(category)) {
    return { error: "Choose a category." };
  }

  const cleanNote = String(note ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_NOTE);
  if (!cleanNote) return { error: "Note is required." };
  if (String(note ?? "").trim().length > MAX_NOTE) {
    return { error: `Note is too long (max ${MAX_NOTE} characters).` };
  }

  return { value: { name: cleanName, email: cleanEmail, category, note: cleanNote } };
}

export function feedbackSubject({ category, name }) {
  return `[CodeShift Feedback] ${category} from ${name}`;
}

export function feedbackBody({ name, email, category, note }) {
  return [
    `Name: ${name}`,
    `Email: ${email}`,
    `Category: ${category}`,
    `Sent: ${new Date().toISOString()}`,
    "",
    "Note:",
    note,
    ""
  ].join("\n");
}

export async function sendFeedbackEmail({ name, email, category, note }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DEVELOPER_EMAIL;
  if (!apiKey || !to) {
    return {
      ok: false,
      error:
        "Feedback email is not configured yet. Please contact the developer directly at the address shown on the site."
    };
  }
  const from = process.env.RESEND_FROM_EMAIL || "CodeShift AI <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: feedbackSubject({ category, name }),
      text: feedbackBody({ name, email, category, note }),
      reply_to: email
    })
  });
  if (!res.ok) {
    const providerBody = await res.text().catch(() => "");
    console.error("[feedback] Resend rejected email", {
      status: res.status,
      body: providerBody.slice(0, 500)
    });
    return {
      ok: false,
      error: `Email provider rejected the message (status ${res.status}). Check the sender address and Resend configuration, then try again.`
    };
  }
  console.info("[feedback] Resend accepted email", { status: res.status });
  return { ok: true };
}
