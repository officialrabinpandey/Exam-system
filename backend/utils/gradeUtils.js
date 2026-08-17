// Grading rules used to be hardcoded here; they're now admin-configurable via
// the Settings model. Every function below takes an optional `settings`
// object and falls back to the original defaults when none is given, so
// existing callers (and tests) keep working unchanged.
const DEFAULT_GRADE_SCALE = [
  { min: 90, grade: "A+", gpa: 4.0 },
  { min: 80, grade: "A", gpa: 3.6 },
  { min: 70, grade: "B+", gpa: 3.2 },
  { min: 60, grade: "B", gpa: 2.8 },
  { min: 50, grade: "C+", gpa: 2.4 },
  { min: 40, grade: "C", gpa: 2.0 },
  { min: 0, grade: "NG", gpa: 0.0 },
];

const DEFAULT_SETTINGS = {
  theoryPassMark: 27,
  theoryFullMarks: 75,
  practicalFullMarks: 25,
  gradeScale: DEFAULT_GRADE_SCALE,
};

// Kept for any code that still imports these directly.
const THEORY_PASS_MARK = DEFAULT_SETTINGS.theoryPassMark;
const GRADE_SCALE = DEFAULT_GRADE_SCALE;

const gradeForPercentage = (percentage, gradeScale = DEFAULT_GRADE_SCALE) => {
  const band = gradeScale.find((b) => percentage >= b.min) || gradeScale[gradeScale.length - 1];
  return { grade: band.grade, gpa: band.gpa };
};

// Decorates one subject's raw theory/practical marks with its total,
// percentage, grade, and the theory-only pass/fail flag.
const decorateSubjectMark = (m, settings = DEFAULT_SETTINGS) => {
  const theoryObtained = m.theoryObtained ?? 0;
  const practicalObtained = m.practicalObtained ?? 0;
  const theoryFullMarks = m.theoryFullMarks ?? settings.theoryFullMarks;
  const practicalFullMarks = m.practicalFullMarks ?? settings.practicalFullMarks;

  const obtainedMarks = theoryObtained + practicalObtained;
  const fullMarks = theoryFullMarks + practicalFullMarks;
  const percentage = fullMarks ? (obtainedMarks / fullMarks) * 100 : 0;
  const { grade, gpa } = gradeForPercentage(percentage, settings.gradeScale);
  const passed = theoryObtained >= settings.theoryPassMark;

  return {
    subject: m.subject,
    theoryObtained,
    theoryFullMarks,
    practicalObtained,
    practicalFullMarks,
    obtainedMarks,
    fullMarks,
    percentage: Math.round(percentage * 100) / 100,
    grade,
    gpa,
    passed,
  };
};

// Decorates a full Result document: every subject via decorateSubjectMark,
// plus overall total/percentage/GPA/grade, and an overall pass/fail that
// fails if ANY subject's theory mark is below the pass threshold. If the
// student was absent for the whole exam, every subject is forced to "AB"
// and failed regardless of any stored marks.
const decorateResult = (result, settings = DEFAULT_SETTINGS) => {
  const plain = typeof result.toObject === "function" ? result.toObject() : result;

  const decoratedMarks = plain.marks.map((m) => {
    const decorated = decorateSubjectMark(m, settings);
    if (plain.absent) {
      return { ...decorated, grade: "AB", gpa: 0, passed: false };
    }
    return decorated;
  });

  const totalObtained = plain.absent ? 0 : decoratedMarks.reduce((sum, m) => sum + m.obtainedMarks, 0);
  const totalFull = decoratedMarks.reduce((sum, m) => sum + m.fullMarks, 0);
  const overallPercentage = plain.absent || !totalFull ? 0 : (totalObtained / totalFull) * 100;
  const averageGpa = plain.absent
    ? 0
    : decoratedMarks.reduce((sum, m) => sum + m.gpa, 0) / (decoratedMarks.length || 1);
  const overallPassed = plain.absent ? false : decoratedMarks.every((m) => m.passed);
  const overallGrade = plain.absent ? "AB" : gradeForPercentage(overallPercentage, settings.gradeScale).grade;

  return {
    ...plain,
    marks: decoratedMarks,
    totalObtained,
    totalFull,
    percentage: Math.round(overallPercentage * 100) / 100,
    gpa: Math.round(averageGpa * 100) / 100,
    grade: overallGrade,
    passed: overallPassed,
  };
};

module.exports = {
  gradeForPercentage,
  decorateSubjectMark,
  decorateResult,
  THEORY_PASS_MARK,
  GRADE_SCALE,
  DEFAULT_SETTINGS,
};
