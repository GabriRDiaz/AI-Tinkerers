import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { google } from "googleapis";
import { DomainError } from "./domain-error";
import type { GoogleSession } from "./google-session";

export const GOOGLE_SESSION_COOKIE = "google-classroom-session";
export const GOOGLE_OAUTH_STATE_COOKIE = "google-oauth-state";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

const SETUP =
  "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_SESSION_SECRET in root .env, enable Classroom and Drive APIs, then restart the web app.";

export function googleOAuthSetupMessage() {
  return SETUP;
}

export function googleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_SESSION_SECRET?.trim(),
  );
}

export function googleRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    "http://127.0.0.1:3100/api/auth/google/callback"
  );
}

function sessionKey() {
  const secret = process.env.GOOGLE_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new DomainError(
      "Set GOOGLE_SESSION_SECRET (at least 16 characters) in root .env.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function sealSession(payload: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

export function openSession<T>(token: string): T | null {
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createOAuthClient() {
  if (!googleOAuthConfigured()) throw new DomainError(SETUP);
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!.trim(),
    process.env.GOOGLE_CLIENT_SECRET!.trim(),
    googleRedirectUri(),
  );
}

export function authorizationUrl(state: string) {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });
}

export function cookieHeader(
  name: string,
  value: string,
  options: { maxAge: number; path?: string; httpOnly?: boolean; secure: boolean },
) {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path ?? "/"}`,
    `Max-Age=${options.maxAge}`,
    "SameSite=Lax",
  ];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookieHeader(
  name: string,
  options: { path?: string; secure: boolean },
) {
  return cookieHeader(name, "", {
    maxAge: 0,
    path: options.path,
    secure: options.secure,
  });
}

export function readCookie(request: Request, name: string) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export function readGoogleSession(request: Request): GoogleSession | null {
  const token = readCookie(request, GOOGLE_SESSION_COOKIE);
  if (!token) return null;
  const session = openSession<GoogleSession>(token);
  if (!session?.accessToken || !session.email) return null;
  return session;
}

export async function exchangeCode(code: string): Promise<GoogleSession> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new DomainError("Google did not return an access token.");
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) {
    throw new DomainError("Google did not return the signed-in user's email.");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
    email: data.email,
    name: data.name?.trim() || data.email,
  };
}

export async function refreshedGoogleSession(
  session: GoogleSession,
): Promise<{ session: GoogleSession; rotated: boolean }> {
  if (session.expiryDate && session.expiryDate > Date.now() + 60_000) {
    return { session, rotated: false };
  }
  if (!session.refreshToken) {
    throw new DomainError("Sign in with Google again to refresh Classroom access.");
  }
  const client = createOAuthClient();
  client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.expiryDate,
  });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new DomainError("Google could not refresh the access token. Sign in again.");
  }
  return {
    session: {
      ...session,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? session.refreshToken,
      expiryDate: credentials.expiry_date ?? session.expiryDate,
    },
    rotated: true,
  };
}

export function sessionCookie(session: GoogleSession, secure: boolean) {
  return cookieHeader(GOOGLE_SESSION_COOKIE, sealSession(session), {
    maxAge: 30 * 24 * 60 * 60,
    secure,
  });
}
