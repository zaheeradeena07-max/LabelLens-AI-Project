const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/userModel");
const Food = require("../src/models/foodModel");

test("user model normalizes email and requires core credentials", async () => {
  const user = new User({ name: "  Ada  ", email: " ADA@example.com ", password: "password123" });
  assert.equal(user.email, "ada@example.com");
  assert.equal(user.name, "Ada");
  await user.validate();
  await assert.rejects(() => new User({ email: "bad", password: "x" }).validate());
});

test("food model accepts valid nutritional data and rejects negative values", async () => {
  await new Food({ name: "Beans", category: "legume", protein: 8, calories: 120 }).validate();
  await assert.rejects(() => new Food({ name: "Beans", category: "legume", protein: -1, calories: 120 }).validate());
});
