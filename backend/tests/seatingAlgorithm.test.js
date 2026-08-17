const test = require("node:test");
const assert = require("node:assert/strict");
const { generateAntiCheatSeats } = require("../utils/seatingAlgorithm");

const makeStudent = (id, optionalSubject) => ({ _id: id, optionalSubject });

test("seats every given student exactly once when they fit the room", () => {
  const students = [
    makeStudent("s1", "Computer"),
    makeStudent("s2", "Bio"),
    makeStudent("s3", "Computer"),
    makeStudent("s4", "Bio"),
  ];
  const seats = generateAntiCheatSeats(students, 2, 2);

  assert.equal(seats.length, 4);
  const seatedIds = seats.filter((s) => s.student).map((s) => s.student).sort();
  assert.deepEqual(seatedIds, ["s1", "s2", "s3", "s4"].sort());
});

test("leaves seats empty (null) when fewer students than capacity", () => {
  const students = [makeStudent("s1", "Computer")];
  const seats = generateAntiCheatSeats(students, 2, 2);

  assert.equal(seats.length, 4);
  const emptyCount = seats.filter((s) => s.student === null).length;
  assert.equal(emptyCount, 3);
});

test("never seats two same-subject students orthogonally adjacent when groups are balanced", () => {
  // 4x4 room = 16 seats, evenly split 8 Computer / 8 Bio — no parity overflow,
  // so the checkerboard guarantee should hold with zero violations.
  const rows = 4;
  const columns = 4;
  const students = [];
  for (let i = 0; i < 8; i++) students.push(makeStudent(`c${i}`, "Computer"));
  for (let i = 0; i < 8; i++) students.push(makeStudent(`b${i}`, "Bio"));

  const seats = generateAntiCheatSeats(students, rows, columns);
  const grid = {};
  seats.forEach((s) => {
    grid[`${s.row}-${s.column}`] = s.student;
  });
  const subjectById = {};
  students.forEach((s) => (subjectById[s._id] = s.optionalSubject));

  let violations = 0;
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      const current = grid[`${row}-${column}`];
      if (!current) continue;
      const neighbors = [
        grid[`${row - 1}-${column}`],
        grid[`${row + 1}-${column}`],
        grid[`${row}-${column - 1}`],
        grid[`${row}-${column + 1}`],
      ];
      neighbors.forEach((n) => {
        if (n && subjectById[n] === subjectById[current]) violations++;
      });
    }
  }
  assert.equal(violations, 0);
});

test("returns an empty room (all-null seats) when given no students", () => {
  const seats = generateAntiCheatSeats([], 2, 3);
  assert.equal(seats.length, 6);
  assert.ok(seats.every((s) => s.student === null));
});
