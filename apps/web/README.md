# An agent inside Google Classroom

**OpenAI + CopilotKit React + Google Classroom + Drive**

Build an agent that sees the selected Classroom course, helps a teacher or student act on it, and creates a Google Doc that remains after a refresh. The incident and Ambiguous sample from the starter kit is gone; this surface is Classroom and Drive.

## Get started

Complete the [root clone/install steps](../../README.md#get-started). Configure `.env` with [OpenAI](../../using-sponsor-tools.md#openai) and a Google OAuth web client:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_SESSION_SECRET=at-least-16-random-characters
GOOGLE_REDIRECT_URI=http://127.0.0.1:3100/api/auth/google/callback
```

### Throwaway Google account (hackathon path)

Use a new or unused Gmail. Do not use a school Workspace account unless you can add unverified apps.

1. Open [classroom.google.com](https://classroom.google.com) with that Gmail and create one empty class (any name).
2. In [Google Cloud Console](https://console.cloud.google.com/) create a project, then enable **Google Classroom API** and **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: User type **External**, Publishing status **Testing**. Add the same Gmail as a test user. App name can be anything.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origin: `http://127.0.0.1:3100`
   - Authorized redirect URI: `http://127.0.0.1:3100/api/auth/google/callback` (must match `.env` exactly; not `localhost`)
5. Put the client ID and secret in root `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Restart `npm run dev:web`.
6. Open `http://127.0.0.1:3100`, click **Sign in with Google**, pick that Gmail, accept the unverified-app warning.

The first Drive write creates a real Google Doc owned by that account. Decline must create nothing.

Choose an OpenAI model your account can use. This web app needs no managed Channel, Intelligence account, or Ambiguous key.

To use OpenRouter, follow the [shared provider settings](../../using-sponsor-tools.md#openrouter): set `MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and a `MODEL` slug with tool support.

```bash
npm run dev:web
```

Open `http://127.0.0.1:3100` and sign in with Google. The credential-backed approval server is loopback-only by default.

## Try the flow

1. Sign in. Check the course list against Classroom for that account.
2. Ask: “What's happening in this course?” The answer should match the selected course and assignments.
3. Ask: “Create a Drive doc for this course.” Review the page proposal.
4. Click **Approve & create in Drive** only if the fields are correct. The app should return the actual Drive file ID and link.
5. Refresh the browser. Ask the agent to retrieve the file by ID, or click **Refresh from Drive**. The same file returns; no duplicate.
6. Repeat with **Decline** and confirm no file is created.

The result should be a retrievable Google Doc with the same ID after refresh. An assistant message saying it saved something is not sufficient.

## Customize these files

| Piece | File |
| --- | --- |
| App and selected course | [src/app/page.tsx](src/app/page.tsx) and [src/lib/classroom-context.ts](src/lib/classroom-context.ts) |
| Context and frontend tools | [src/components/app-control.tsx](src/components/app-control.tsx): `useAgentContext`, `select_course`, `select_assignment`, `propose_drive_doc`, `retrieve_drive_doc`, `refresh_drive_docs` |
| Approval UI | [src/components/drive-docs.tsx](src/components/drive-docs.tsx) and [src/lib/use-classroom.ts](src/lib/use-classroom.ts) |
| Google OAuth | [src/app/api/auth](src/app/api/auth) and [src/lib/server/google-oauth.ts](src/lib/server/google-oauth.ts) |
| Classroom and Drive clients | [src/lib/server/google-clients.ts](src/lib/server/google-clients.ts) |
| Server approval boundary | [src/app/api/docs/route.ts](src/app/api/docs/route.ts) and [src/lib/server/doc-approvals.ts](src/lib/server/doc-approvals.ts) |
| CopilotKit React UI | [src/components/generative-ui.tsx](src/components/generative-ui.tsx) and [src/components/providers.tsx](src/components/providers.tsx) |
| Agent endpoint | [src/app/api/copilotkit/[[...path]]/route.ts](src/app/api/copilotkit/[[...path]]/route.ts), configured without raw Drive write tools |

The web chat does not receive raw Drive write tools. It can propose a document and read or refresh existing files through frontend tools; the server writes only after the user clicks **Approve & create in Drive**. Returned links must come from Drive rather than being invented.

Slack, mobile, Exa, Auth0, and Ambiguous remain in this checkout as unused starter surfaces. Do not start them for this project.

## Verify and limits

Run `npm run verify` and `npm run build --workspace web` for local checks. Then try the create/read/decline flow with a Classroom account you control. Offline tests cover the approval boundary and error handling; they do not make live Google calls.

`drive.file` only lists and writes files this app created. Existing course Drive folders are not rewritten.

[CopilotKit docs](https://docs.copilotkit.ai/) · [Sponsor authentication and first calls](../../using-sponsor-tools.md) · [Classroom API](https://developers.google.com/classroom/reference/rest) · [Drive API](https://developers.google.com/drive/api/guides/about-sdk)
