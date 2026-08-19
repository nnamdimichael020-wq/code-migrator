// Reviews: sanitisation, validation and KV persistence.
//
// Reviews are published immediately (no moderation queue) so input is
// sanitised server-side: HTML tags and control characters are stripped,
// lengths are capped, and the rate limiter blocks flooding. React escapes
// output when rendering, which is the second layer.

import { kvConfig, kvGet, kvPut } from "./kv.js";

export const REVIEWS_KEY = "reviews:v1";
export const MAX_REVIEWS = 200; // oldest are dropped past this
export const MAX_MESSAGE = 1000;
export const MAX_NAME = 60;
export const MAX_LANG = 50;

// Strips tags/control chars but keeps newlines so a short multi-line
// message survives intact.
export function sanitizeMessage(value, maxLen = MAX_MESSAGE) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

// Single-line fields (name): also collapse whitespace.
export function sanitizeName(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

export function validateReview({ stars, message, name, displayName, sourceLang, targetLang } = {}) {
  const s = Number(stars);
  if (!Number.isInteger(s) || s < 1 || s > 5) {
    return { error: "Stars must be a whole number from 1 to 5." };
  }
  const cleanMessage = sanitizeMessage(message, MAX_MESSAGE);
  if (String(message ?? "").trim().length > MAX_MESSAGE) {
    return { error: `Message is too long (max ${MAX_MESSAGE} characters).` };
  }
  // Older clients send `name`; newer clients may send `displayName`.
  // Prefer the explicitly supplied displayName, then fall back to name.
  const suppliedName = displayName ?? name;
  const cleanName = sanitizeName(suppliedName);
  return {
    value: {
      stars: s,
      message: cleanMessage, // may be "" for a stars-only review from the popup
      name: cleanName,
      displayName: cleanName,
      sourceLang:
        typeof sourceLang === "string" ? sourceLang.trim().slice(0, MAX_LANG) : "",
      targetLang:
        typeof targetLang === "string" ? targetLang.trim().slice(0, MAX_LANG) : ""
    }
  };
}

function parseList(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((r) => r && typeof r === "object") : [];
  } catch {
    return [];
  }
}

export async function listReviews(config = kvConfig()) {
  const raw = await kvGet(config, REVIEWS_KEY);
  return parseList(raw);
}

export async function addReview(config, review) {
  const list = await listReviews(config);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stars: review.stars,
    message: review.message,
    displayName: sanitizeName(review.displayName ?? review.name) || "Anonymous",
    createdAt: new Date().toISOString(),
    sourceLang: review.sourceLang || "",
    targetLang: review.targetLang || ""
  };
  const next = [entry, ...list].slice(0, MAX_REVIEWS);
  await kvPut(config, REVIEWS_KEY, JSON.stringify(next));
  return entry;
}
