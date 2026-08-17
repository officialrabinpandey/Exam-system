// Mirrors backend/utils/gradeUtils.js so the ledger can show live totals,
// grades, and red fail-highlighting as the user types, without a round trip
// to the server on every keystroke. Must stay in sync with the backend.

const GRADE_SCALE = [
  { min: 90, grade: "A+", gpa: 4.0 },
  { min: 80, grade: "A", gpa: 3.6 },
  { min: 70, grade: "B+", gpa: 3.2 },
  { min: 60, grade: "B", gpa: 2.8 },
  { min: 50, grade: "C+", gpa: 2.4 },
  { min: 40, grade: "C", gpa: 2.0 },
  { min: 0, grade: "NG", gpa: 0.0 },
];

export const THEORY_PASS_MARK = 27;

export const gradeForPercentage = (percentage) => {
  const band = GRADE_SCALE.find((b) => percentage >= b.min);
  return { grade: band.grade, gpa: band.gpa };
};

export const decorateSubjectMark = (m) => {
  const theoryObtained = Number(m.theoryObtained) || 0;
  const practicalObtained = Number(m.practicalObtained) || 0;
  const theoryFullMarks = m.theoryFullMarks ?? 75;
  const practicalFullMarks = m.practicalFullMarks ?? 25;

  const obtainedMarks = theoryObtained + practicalObtained;
  const fullMarks = theoryFullMarks + practicalFullMarks;
  const percentage = fullMarks ? (obtainedMarks / fullMarks) * 100 : 0;
  const { grade, gpa } = gradeForPercentage(percentage);
  const passed = theoryObtained >= THEORY_PASS_MARK;

  return {
    ...m,
    theoryObtained,
    practicalObtained,
    theoryFullMarks,
    practicalFullMarks,
    obtainedMarks,
    fullMarks,
    percentage: Math.round(percentage * 100) / 100,
    grade,
    gpa,
    passed,
  };
};

export const decorateRow = (marks) => {
  const decoratedMarks = marks.map(decorateSubjectMark);
  const totalObtained = decoratedMarks.reduce((sum, m) => sum + m.obtainedMarks, 0);
  const totalFull = decoratedMarks.reduce((sum, m) => sum + m.fullMarks, 0);
  const overallPercentage = totalFull ? (totalObtained / totalFull) * 100 : 0;
  const averageGpa =
    decoratedMarks.reduce((sum, m) => sum + m.gpa, 0) / (decoratedMarks.length || 1);
  const overallPassed = decoratedMarks.every((m) => m.passed);
  const overallGrade = gradeForPercentage(overallPercentage).grade;

  return {
    marks: decoratedMarks,
    totalObtained,
    totalFull,
    percentage: Math.round(overallPercentage * 100) / 100,
    gpa: Math.round(averageGpa * 100) / 100,
    grade: overallGrade,
    passed: overallPassed,
  };
};
