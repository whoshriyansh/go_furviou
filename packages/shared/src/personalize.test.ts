import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichLeadValues,
  leadToPersonalizeValues,
  personalizeTemplate,
  splitFullName,
} from "./personalize";

test("splits a mapped full name into first and last", () => {
  assert.deepEqual(splitFullName("Shriyansg Lohia"), {
    firstName: "Shriyansg",
    lastName: "Lohia",
  });
});

test("personalize uses lastName derived from fullName", () => {
  const values = leadToPersonalizeValues({
    email: "shriyansh@plavist.com",
    fullName: "Shriyansg Lohia",
    iceBreaker: "loved your shop",
  });
  assert.equal(values.lastName, "Lohia");
  assert.equal(values.firstName, "Shriyansg");
  assert.equal(
    personalizeTemplate("{{email}} {{lastName}} {{iceBreaker}}", values),
    "shriyansh@plavist.com Lohia loved your shop",
  );
});

test("{{name}} maps to full name", () => {
  const values = enrichLeadValues({ firstName: "Ada", lastName: "Lovelace" });
  assert.equal(personalizeTemplate("Hi {{name}}", values), "Hi Ada Lovelace");
});
