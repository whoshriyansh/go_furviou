import assert from "node:assert/strict";
import test from "node:test";
import {
  suggestLeadField,
  stripLeadingSubjectLine,
} from "./leadFields";
import { enrichLeadValues, personalizeTemplate } from "./personalize";

test("maps the Furviou lead sheet columns", () => {
  assert.equal(suggestLeadField("email"), "email");
  assert.equal(suggestLeadField("contact_name"), "fullName");
  assert.equal(suggestLeadField("contact_title"), "jobTitle");
  assert.equal(suggestLeadField("city_state"), "city");
  assert.equal(suggestLeadField("current_domain"), "website");
  assert.equal(suggestLeadField("Subject Line"), "subjectLine");
  assert.equal(suggestLeadField("Email 1 (Icebreaker)"), "iceBreaker");
  assert.equal(suggestLeadField("Follow Up 1 (Day 3)"), "followUp1");
  assert.equal(suggestLeadField("Follow Up 2 (Day 7)"), "followUp2");
  assert.equal(suggestLeadField("Follow Up 3 (Day 12 - breakup)"), "followUp3");
});

test("strips a leading Subject: line from follow-up copy", () => {
  const cleaned = stripLeadingSubjectLine(
    "Subject: following up — Northwind\n\nHi Alex,\n\nJust bumping this.",
  );
  assert.equal(cleaned, "Hi Alex,\n\nJust bumping this.");
  assert.equal(stripLeadingSubjectLine("Hi Alex,"), "Hi Alex,");
});

test("personalize follow-ups and subject line, stripping leftover Subject: prefixes", () => {
  const values = enrichLeadValues({
    email: "alex@example.com",
    subjectLine: "quick redesign idea",
    iceBreaker: "Hi Alex,\n\nLoved the shop.",
    followUp1: "Subject: quick nudge\n\nHi Alex,\n\nJust bumping this.",
    followUp2: "Happy to share an example.",
    followUp3: "Last check-in.",
  });
  assert.equal(values.subjectLine, "quick redesign idea");
  assert.equal(
    personalizeTemplate("{{subjectLine}}", values),
    "quick redesign idea",
  );
  assert.equal(
    personalizeTemplate("{{followUp1}}", values),
    "Hi Alex,\n\nJust bumping this.",
  );
  assert.equal(personalizeTemplate("{{followUp2}}", values), "Happy to share an example.");
  assert.equal(personalizeTemplate("{{iceBreaker}}", values), "Hi Alex,\n\nLoved the shop.");
});
