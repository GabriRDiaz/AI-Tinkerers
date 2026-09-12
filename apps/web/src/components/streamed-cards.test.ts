import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseCard, Timeline } from "./streamed-cards";

test("course card renders loading content before any arguments arrive", () => {
  const html = renderToStaticMarkup(createElement(CourseCard, {}));
  assert.match(html, /Preparing course summary/);
});

test("course card preserves the headline while other fields are streaming", () => {
  const html = renderToStaticMarkup(createElement(CourseCard, { headline: "Biology 101" }));
  assert.match(html, /Biology 101/);
  assert.match(html, /Gathering course details/);
});

test("course card tolerates partial arrays and nested entries", () => {
  const html = renderToStaticMarkup(createElement(CourseCard, {
    tone: "att",
    facts: [null, {}, { label: "Section" }, { label: "Due", value: "Friday" }],
    nextSteps: [null, "Draft the rubric"],
  }));
  assert.match(html, /var\(--muted\)/);
  assert.match(html, /Section/);
  assert.match(html, /Friday/);
  assert.match(html, /Draft the rubric/);
  assert.match(html, /Loading/);
});

test("timeline renders loading content for empty and title-only arguments", () => {
  assert.match(renderToStaticMarkup(createElement(Timeline, {})), /Preparing timeline/);
  const html = renderToStaticMarkup(createElement(Timeline, { title: "Upcoming work" }));
  assert.match(html, /Upcoming work/);
  assert.match(html, /Preparing timeline/);
  assert.match(renderToStaticMarkup(createElement(Timeline, { columns: ["Due"] })), /Loading events/);
  assert.match(renderToStaticMarkup(createElement(Timeline, { rows: [["Friday"]] })), /Preparing timeline/);
  assert.match(renderToStaticMarkup(createElement(Timeline, { columns: null, rows: null })), /Preparing timeline/);
});

test("timeline tolerates partially streamed columns, rows, and cells", () => {
  const html = renderToStaticMarkup(createElement(Timeline, {
    columns: ["Due", null],
    rows: [null, [], ["Friday"], ["Monday", null]],
  }));
  assert.match(html, /Due/);
  assert.match(html, /Friday/);
  assert.match(html, /Monday/);
  assert.match(html, /Loading/);
});

test("complete course and timeline arguments render their content", () => {
  const card = renderToStaticMarkup(createElement(CourseCard, {
    headline: "Lab reports due", summary: "Three assignments need a rubric",
    facts: [{ label: "Open", value: "3" }], nextSteps: ["Draft rubric"], tone: "good",
  }));
  for (const text of ["Lab reports due", "Three assignments need a rubric", "Open", "3", "Draft rubric", "#2e7d5b"]) {
    assert.ok(card.includes(text));
  }
  assert.doesNotMatch(card, /Loading|Preparing|Gathering/);
  const timeline = renderToStaticMarkup(createElement(Timeline, {
    title: "Work", columns: ["Due", "Title"], rows: [["Fri", "Lab 1"], ["Mon", "Lab 2"]],
  }));
  for (const text of ["Work", "Due", "Title", "Fri", "Lab 1", "Mon", "Lab 2"]) {
    assert.ok(timeline.includes(text));
  }
  assert.doesNotMatch(timeline, /Loading|Preparing/);
});
