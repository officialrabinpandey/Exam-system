const test = require("node:test");
const assert = require("node:assert/strict");
const { gradeForPercentage, decorateSubjectMark, decorateResult, THEORY_PASS_MARK } = require("../utils/gradeUtils");

test("theory pass mark constant is 27", () => {
  assert.equal(THEORY_PASS_MARK, 27);
});

test("grade bands map percentages correctly", () => {
  assert.equal(gradeForPercentage(95).grade, "A+");
  assert.equal(gradeForPercentage(85).grade, "A");
  assert.equal(gradeForPercentage(75).grade, "B+");
  assert.equal(gradeForPercentage(65).grade, "B");
  assert.equal(gradeForPercentage(55).grade, "C+");
  assert.equal(gradeForPercentage(45).grade, "C");
  assert.equal(gradeForPercentage(10).grade, "NG");
});

test("a subject fails when theory is below 27, regardless of practical", () => {
  const failing = decorateSubjectMark({ subject: "Physics", theoryObtained: 26, practicalObtained: 25 });
  assert.equal(failing.passed, false);

  const passing = decorateSubjectMark({ subject: "Physics", theoryObtained: 27, practicalObtained: 0 });
  assert.equal(passing.passed, true);
});

test("decorateResult fails overall if any single subject fails", () => {
  const result = {
    marks: [
      { subject: "English", theoryObtained: 60, practicalObtained: 20 },
      { subject: "Maths", theoryObtained: 20, practicalObtained: 20 }, // fails theory
    ],
  };
  const decorated = decorateResult(result);
  assert.equal(decorated.passed, false);
});

test("decorateResult passes overall only when every subject passes", () => {
  const result = {
    marks: [
      { subject: "English", theoryObtained: 60, practicalObtained: 20 },
      { subject: "Maths", theoryObtained: 40, practicalObtained: 15 },
    ],
  };
  const decorated = decorateResult(result);
  assert.equal(decorated.passed, true);
  assert.equal(decorated.totalObtained, 135);
  assert.equal(decorated.totalFull, 200);
});

test("absent flag forces AB grade and overall fail regardless of stored marks", () => {
  const result = {
    absent: true,
    marks: [{ subject: "English", theoryObtained: 70, practicalObtained: 25 }],
  };
  const decorated = decorateResult(result);
  assert.equal(decorated.grade, "AB");
  assert.equal(decorated.passed, false);
  assert.equal(decorated.totalObtained, 0);
});
