import { DomainError } from "./domain-error";
import {
  googleOAuthConfigured,
  googleOAuthSetupMessage,
  readGoogleSession,
  refreshedGoogleSession,
  sessionCookie,
} from "./google-oauth";
import { googleApiClients } from "./google-clients";
import type { GoogleSession } from "./google-session";

export async function requireGoogleClients(request: Request) {
  if (!googleOAuthConfigured()) {
    throw new DomainError(googleOAuthSetupMessage());
  }
  const current = readGoogleSession(request);
  if (!current) return undefined;
  const { session, rotated } = await refreshedGoogleSession(current);
  const clients = googleApiClients(session);
  const secure = new URL(request.url).protocol === "https:";
  return {
    session,
    ...clients,
    setCookie: rotated ? sessionCookie(session, secure) : undefined,
  };
}

export function publicUser(session: GoogleSession) {
  return { email: session.email, name: session.name };
}
