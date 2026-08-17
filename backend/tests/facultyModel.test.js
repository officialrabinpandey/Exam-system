const test = require("node:test");
const assert = require("node:assert/strict");
const Faculty = require("../models/Faculty");

test("a faculty with no elective group returns just its compulsory subjects", () => {
  const mgmt = new Faculty({
    name: "Management",
    compulsorySubjects: ["Accounting", "English", "Nepali", "Computer", "Social Studies", "Economics"],
    electiveGroupName: "",
    electiveOptions: [],
  });
  assert.deepEqual(mgmt.subjectsForElectiveChoice(""), [
    "Accounting", "English", "Nepali", "Computer", "Social Studies", "Economics",
  ]);
  assert.deepEqual(mgmt.allSubjectColumns(), [
    "Accounting", "English", "Nepali", "Computer", "Social Studies", "Economics",
  ]);
});

test("a faculty with an elective group includes only the student's chosen option", () => {
  const science = new Faculty({
    name: "Science",
    compulsorySubjects: ["English", "Maths", "Physics", "Chemistry", "Nepali"],
    electiveGroupName: "Science Elective",
    electiveOptions: ["Biology", "Computer"],
  });
  assert.deepEqual(science.subjectsForElectiveChoice("Biology"), [
    "English", "Maths", "Physics", "Chemistry", "Nepali", "Biology",
  ]);
  assert.deepEqual(science.subjectsForElectiveChoice("Computer"), [
    "English", "Maths", "Physics", "Chemistry", "Nepali", "Computer",
  ]);
});

test("allSubjectColumns lists every elective option, not just one student's choice", () => {
  const science = new Faculty({
    name: "Science",
    compulsorySubjects: ["English", "Maths", "Physics", "Chemistry", "Nepali"],
    electiveGroupName: "Science Elective",
    electiveOptions: ["Biology", "Computer"],
  });
  assert.deepEqual(science.allSubjectColumns(), [
    "English", "Maths", "Physics", "Chemistry", "Nepali", "Biology", "Computer",
  ]);
});
