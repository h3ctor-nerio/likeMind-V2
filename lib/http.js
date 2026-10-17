import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "./auth";

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (error, status = 400) => NextResponse.json({ error }, { status });

export function oid(id) {
  return typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function str(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function list(value, maxItems = 15, maxLen = 40) {
  const arr = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const s = String(v).trim().toLowerCase().replace(/^#/, "").slice(0, maxLen);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Wrap a route handler: catches errors and supplies the signed-in user. */
export function route(handler, { auth = false } = {}) {
  return async (req, ctx) => {
    try {
      const user = await getCurrentUser();
      if (auth && !user) return fail("Sign in to do that.", 401);
      const params = ctx?.params ? await ctx.params : {};
      return await handler(req, { user, params });
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || "");
      const config = msg.includes("MONGODB_URI") || msg.includes("SESSION_SECRET");
      return fail(config ? msg : "The server hit an error. Check the terminal running the app for details.", 500);
    }
  };
}
