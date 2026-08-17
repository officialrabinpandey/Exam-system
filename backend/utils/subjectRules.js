const Faculty = require("../models/Faculty");

// Every subject is marked out of 75 (theory) + 25 (practical) = 100 total.
// (Kept as constants here for now — see Settings for the admin-configurable
// pass mark and grading scale.)
const THEORY_FULL_MARKS = 75;
const PRACTICAL_FULL_MARKS = 25;

// The two faculties every fresh install expects to exist (normally created
// by `npm run seed`). If a deployment's seed step never ran, was pointed at
// the wrong database, or ran before this field existed, mark entry would
// otherwise fail for 100% of students with no obvious cause. Auto-creating
// these two specific, well-known defaults on first use removes that whole
// class of deployment footgun. A genuinely custom faculty (added via the
// Faculties page) still throws if it's missing — there's no safe default to
// invent for those.
const BUILTIN_FACULTY_DEFAULTS = {
  Management: {
    name: "Management",
    compulsorySubjects: ["Accounting", "English", "Nepali", "Computer", "Social Studies", "Economics"],
    electiveGroupName: "",
    electiveOptions: [],
  },
  Science: {
    name: "Science",
    compulsorySubjects: ["English", "Maths", "Physics", "Chemistry", "Nepali"],
    electiveGroupName: "Science Elective",
    electiveOptions: ["Biology", "Computer"],
  },
};

// Looks up a student's faculty document, self-healing the two built-in
// defaults if missing. Throws a descriptive error only for a genuinely
// unrecognized (custom) faculty name.
const getFacultyDoc = async (facultyName) => {
  let faculty = await Faculty.findOne({ name: facultyName });
  if (!faculty && BUILTIN_FACULTY_DEFAULTS[facultyName]) {
    try {
      faculty = await Faculty.create(BUILTIN_FACULTY_DEFAULTS[facultyName]);
    } catch (err) {
      // Another concurrent request created it first — that's fine, just use it.
      if (err.code === 11000) {
        faculty = await Faculty.findOne({ name: facultyName });
      } else {
        throw err;
      }
    }
  }
  if (!faculty) {
    throw new Error(`Faculty "${facultyName}" is not configured. Add it under Faculties first.`);
  }
  return faculty;
};

// Returns the fixed list of subjects a given student should be marked on:
// their faculty's compulsory subjects, plus their chosen elective (if that
// faculty has an elective group at all).
const getSubjectsForStudent = async (student) => {
  const faculty = await getFacultyDoc(student.faculty);
  return faculty.subjectsForElectiveChoice(student.optionalSubject);
};

// The full, fixed column set for a class ledger — includes EVERY elective
// option as its own column (not just the one a given student picked), since
// a class ledger mixes students with different elective choices. A student's
// inapplicable elective column simply isn't part of their own subject list
// (see getSubjectsForStudent above) and is left blank/disabled in the ledger.
const getLedgerColumns = async (facultyName) => {
  const faculty = await getFacultyDoc(facultyName);
  return faculty.allSubjectColumns();
};

module.exports = {
  getFacultyDoc,
  getSubjectsForStudent,
  getLedgerColumns,
  THEORY_FULL_MARKS,
  PRACTICAL_FULL_MARKS,
};
