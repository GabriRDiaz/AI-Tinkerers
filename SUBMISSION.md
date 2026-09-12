# Submission checklist

Choose your city on the [global event page](https://aitinkerers.org/hackathons/global/agents-everywhere). Use that city's participant portal for the submission deadline and published judging criteria, and its handbook for eligibility and required deliverables. See [hackathon-rules.md](hackathon-rules.md) for the agent-readable summary.

## Build eligibility

- [ ] Our submitted project is a net-new build created during the official hackathon period
- [ ] Its core functionality was built during the event; we are not resubmitting or extending a pre-existing project and entering it as new
- [ ] We identify inherited templates, libraries, prompts, components, and starter code separately from our event work

**What we inherited**
Agents, Everywhere starter kit: Next.js CopilotKit web runtime (`apps/web` providers, `/api/copilotkit`, `packages/agent-core` model adapter and `BuiltInAgent` factory), page-context / frontend-tool / approval-before-write pattern, and unused Slack, mobile, Exa, Auth0, and Ambiguous starter surfaces.

**What we built during the hackathon**
Google user OAuth, Classroom course/assignment reads, Drive document create with page approval and read-back. Implementation lives in `apps/web/src/app/api/auth`, `apps/web/src/app/api/classroom`, `apps/web/src/app/api/docs`, `apps/web/src/lib/server/google-*.ts`, `apps/web/src/lib/server/doc-approvals.ts`, and the Classroom page/tools in `apps/web/src/app/page.tsx`, `apps/web/src/components/app-control.tsx`, and `apps/web/src/components/drive-docs.tsx`. The incident/Ambiguous demo domain was replaced.

## Title and description

**What you built**
A web Classroom assistant: sign in with Google, open a live course, ask the agent about the visible assignments, then approve a Google Doc that is created in Drive and can be read back after refresh.

**Who it is for**
A teacher (or student) already looking at a Google Classroom course who needs a course-aware document without leaving the page.

**Why the context matters**
Without the selected course and assignment on the page, the agent cannot choose the right Classroom record or attach the Drive file to that course. A standalone chatbox would require the user to paste IDs and links.

**Sponsor technologies used**
OpenAI (or OpenRouter) for the model. CopilotKit React for page context, frontend tools, and chat UI. Google Classroom and Drive are the live data and write targets (not kit sponsors).

## Evidence for the judging criteria

Judges score each of the four official criteria from 1–5. This checklist helps you gather evidence; it does not guarantee a score. A working starter is a foundation for your own project.

| Official criterion | Show in your project and demo |
|---|---|
| Core Requirements & Functionality | Run one complete workflow in the intended environment, from user request through tools to a verified result. Repeat it with live integrations; offline tests alone do not prove the deployed flow. |
| Innovation & Theme Alignment | Show the surrounding context before the prompt and explain the original interaction it enables. Compare with the context removed: what value would a standalone chatbox lose? |
| Technical Execution & Integration | Show how tools, data, and the environment connect. Demonstrate a relevant failure or cancellation path and explain recovery, state persistence, and integration limits. |
| Usefulness & Agentic Experience | Identify the user and problem, show a meaningful action in the surface, and demonstrate clear feedback and appropriate user control. Explain what work the agent saves. |

- [ ] We can point to visible evidence for every criterion
- [ ] We distinguish live services, sample data, session-only state, and standalone recipes
- [ ] Sponsor technologies contribute to the workflow; their count is not a judging criterion

## Public repository

- [ ] A new participant can run the quickstart from a clean clone
- [ ] The README lists the credentials and separate processes required
- [ ] `npm run verify` passes; optional recipe checks pass if used
- [ ] `.env`, tokens, generated traces with sensitive data, and account secrets are excluded
- [ ] Sample data, session-only state, and unimplemented integrations are clearly labeled

## Two-minute demo video

- [ ] Show the surface and existing context before the prompt
- [ ] Demonstrate one complete interaction
- [ ] Show a visible result: an actual record, local state change, or research source links
- [ ] If showing an approval, distinguish the decision from execution and demonstrate the resulting behavior
- [ ] State which sponsor technologies made the interaction possible
- [ ] Keep the video within the event's limit and check audio

See [demo prompts](dev-docs/demo-prompts.md) for a reproducible incident workflow.

## Social post and final submission

- [ ] Follow the organizer's posting and sponsor-tagging instructions
- [ ] Link the public repository and video
- [ ] Credit the sponsors you used and applicable local partners
- [ ] Check the live integration once more before recording or submitting
- [ ] Inspect the repository, video and screenshots for secrets

Prepare the post and submission for a human to publish; running the starter kit
does not publish either automatically.
