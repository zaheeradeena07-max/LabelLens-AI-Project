const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLabel } = require("../src/routes/uploadRoutes");

test("finds declared allergen and separates precautionary statement", () => {
  const result = parseLabel("Snack Chips\nIngredients: peanuts, rice flour, salt\nContains: peanuts\nMay contain milk\nNutrition Facts Calories 150 Total Fat 5g Sodium 20mg", {
    allergens: ["Peanuts", "Milk/dairy"], otherAllergens: [], dietaryPreferences: ["Vegan"], customRestrictions: [], avoidIngredients: [],
  });
  assert.deepEqual(result.detectedIngredients, ["peanuts", "rice flour", "salt"]);
  assert.equal(result.allergenMatches[0].allergen, "Peanuts");
  assert.equal(result.allergenMatches[0].source, "ingredients");
  assert.equal(result.allergenMatches[1].status, "precautionary_match");
  assert.deepEqual(result.precautionaryStatements, ["May contain milk"]);
  assert.equal(result.nutrition.values.calories, "150");
  assert.equal(result.nutrition.values["total fat"], "5g");
  assert.equal(result.nutrition.values.sodium, "20mg");
});

test("does not claim a match when ingredients are unreadable", () => {
  const result = parseLabel("Product\nNutrition Facts", {
    allergens: ["Peanuts"], otherAllergens: [], dietaryPreferences: ["Vegan"], customRestrictions: [], avoidIngredients: [],
  });
  assert.deepEqual(result.allergenMatches, []);
  assert.equal(result.dietaryConflicts[0].status, "unable_to_determine");
  assert.equal(result.summary, "unable_to_determine");
  assert.equal(result.ingredientText, null);
});
