import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { appwriteServerKey } from "../appwrite/config";

/**
 * Minimal, stateless OAuth 2.1 helpers for the MCP endpoint.
 *
 * Authorization codes and access tokens are self-contained HMAC-signed strings,
 * so no extra Appwrite collection or server-side session store is required.
 * This keeps the flow compatible with Appwrite Sites/Functions (which buffer
 * responses and don't keep long-lived in-memory state).
 */

/** Access token lifetime: 30 days. */
export const ACCESS_TOKEN_TTL = 60 * 60 * 24 * 30;
/** Authorization codes are single-use and short-lived (5 minutes). */
const AUTH_CODE_TTL = 60 * 5;
/** OAuth scope advertised and granted by this server. */
export const MCP_SCOPE = "mcp";

type AuthCodePayload = {
  t: "code";
  sub: string;
  cid: string;
  ruri: string;
  cc: string;
  exp: number;
};

type AccessTokenPayload = {
  t: "at";
  sub: string;
  exp: number;
};

/** Signing secret. Falls back to the Appwrite server key when unset. */
function secret(): string {
  return process.env.MCP_OAUTH_SECRET || appwriteServerKey || "dev-insecure-secret";
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function sign(payload: object): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

function verify<T extends { exp?: number }>(token: string): T | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as T;
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/** Issues a signed, single-use authorization code bound to a PKCE challenge. */
export function issueAuthorizationCode(args: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): string {
  const payload: AuthCodePayload = {
    t: "code",
    sub: args.userId,
    cid: args.clientId,
    ruri: args.redirectUri,
    cc: args.codeChallenge,
    exp: now() + AUTH_CODE_TTL,
  };
  return sign(payload);
}

export type VerifiedAuthCode = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
};

/** Verifies and decodes an authorization code, or returns null when invalid. */
export function verifyAuthorizationCode(code: string): VerifiedAuthCode | null {
  const payload = verify<AuthCodePayload>(code);
  if (!payload || payload.t !== "code") return null;
  return {
    userId: payload.sub,
    clientId: payload.cid,
    redirectUri: payload.ruri,
    codeChallenge: payload.cc,
  };
}

/** Issues a signed bearer access token for the given user. */
export function issueAccessToken(userId: string): string {
  const payload: AccessTokenPayload = {
    t: "at",
    sub: userId,
    exp: now() + ACCESS_TOKEN_TTL,
  };
  return sign(payload);
}

/** Returns the userId for a valid OAuth access token, otherwise null. */
export function verifyAccessToken(token: string): string | null {
  const payload = verify<AccessTokenPayload>(token);
  if (!payload || payload.t !== "at") return null;
  return payload.sub;
}

/** Verifies an RFC 7636 S256 PKCE code_verifier against a code_challenge. */
export function verifyPkceS256(
  verifier: string,
  challenge: string,
): boolean {
  if (!verifier || !challenge) return false;
  const hash = b64url(createHash("sha256").update(verifier).digest());
  const a = Buffer.from(hash);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Generates an opaque public client identifier for dynamic registration. */
export function generateClientId(): string {
  return `mcp_${randomBytes(16).toString("hex")}`;
}

/**
 * Resolves the externally-visible base URL of this deployment, honoring proxy
 * headers (Appwrite Sites) and an optional explicit override.
 */
export function baseUrl(request: NextRequest): string {
  const override = process.env.NEXT_PUBLIC_APP_URL;
  if (override) return override.replace(/\/+$/, "");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

/** Permissive CORS headers so browser-based MCP/OAuth clients can connect. */
export function corsHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}
