import assert from "node:assert/strict";
import test from "node:test";
import {
  googleOAuthConfigured,
  openSession,
  sealSession,
} from "./google-oauth";

const secret = { GOOGLE_SESSION_SECRET: "test-session-secret-key" };

test("sealed sessions round-trip and reject tampering", () => {
  const previous = process.env.GOOGLE_SESSION_SECRET;
  process.env.GOOGLE_SESSION_SECRET = secret.GOOGLE_SESSION_SECRET;
  try {
    const token = sealSession({ email: "teacher@school.edu", accessToken: "tok" });
    assert.deepEqual(openSession(token), {
      email: "teacher@school.edu",
      accessToken: "tok",
    });
    assert.equal(openSession("not-a-token"), null);
    assert.equal(openSession(`${token}aa`), null);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_SESSION_SECRET;
    else process.env.GOOGLE_SESSION_SECRET = previous;
  }
});

test("oauth is unconfigured without the three required env values", () => {
  const snapshot = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_SESSION_SECRET: process.env.GOOGLE_SESSION_SECRET,
  };
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_SESSION_SECRET;
  try {
    assert.equal(googleOAuthConfigured(), false);
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_SESSION_SECRET = "session-secret-ok";
    assert.equal(googleOAuthConfigured(), true);
  } finally {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
