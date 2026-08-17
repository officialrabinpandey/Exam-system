// Shuffles an array in place (Fisher-Yates) and returns it.
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const seatKey = (row, column) => `${row}-${column}`;

/**
 * Builds a seating assignment for a room using a checkerboard strategy:
 * every seat's orthogonal neighbours (left/right/up/down) sit on the
 * opposite "parity" of the (row+column) checkerboard, so filling one
 * optional-subject group onto even-parity seats and another onto odd-parity
 * seats guarantees no two orthogonally-adjacent students share that subject,
 * as long as there are enough seats of each parity. Overflow (when one
 * group is larger than its parity's seat count) spills into the other
 * parity's leftover seats — those seats can never be adjacent to each
 * other, so no new adjacency conflicts are introduced.
 *
 * Groups students by their actual `optionalSubject` value — whatever string
 * that is, from whatever faculty's elective list it came from — rather than
 * hardcoding specific subject names. The two largest groups get the full
 * two-parity guarantee; any further distinct groups (more than two electives
 * across the room) are distributed afterward on a best-effort basis, since a
 * two-coloring can only fully separate two groups at once.
 *
 * Students are shuffled first, so seating is not in roll-number order.
 */
function generateAntiCheatSeats(students, rows, columns) {
  const seatPositions = [];
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      seatPositions.push({ row, column, parity: (row + column) % 2 });
    }
  }

  const evenSeats = shuffle(seatPositions.filter((s) => s.parity === 0));
  const oddSeats = shuffle(seatPositions.filter((s) => s.parity === 1));

  // Group by optionalSubject value (empty/undefined counts as its own group
  // — e.g. Management students with no elective). Largest groups first.
  const groupsByKey = {};
  students.forEach((s) => {
    const key = s.optionalSubject || "__none__";
    if (!groupsByKey[key]) groupsByKey[key] = [];
    groupsByKey[key].push(s);
  });
  const sortedGroups = Object.values(groupsByKey).sort((a, b) => b.length - a.length);

  const firstGroup = shuffle(sortedGroups[0] || []);
  const secondGroup = shuffle(sortedGroups[1] || []);
  const remainingGroups = shuffle(sortedGroups.slice(2).flat());

  const assignment = {}; // seatKey -> studentId
  let evenIdx = 0;
  let oddIdx = 0;

  const takeSeat = () => {
    if (evenIdx < evenSeats.length) return evenSeats[evenIdx++];
    if (oddIdx < oddSeats.length) return oddSeats[oddIdx++];
    return null;
  };
  const takeParityFirst = (preferOdd) => {
    if (preferOdd) {
      if (oddIdx < oddSeats.length) return oddSeats[oddIdx++];
      if (evenIdx < evenSeats.length) return evenSeats[evenIdx++];
      return null;
    }
    return takeSeat();
  };

  firstGroup.forEach((student) => {
    const seat = takeParityFirst(false); // prefer even seats
    if (seat) assignment[seatKey(seat.row, seat.column)] = student._id.toString();
  });
  secondGroup.forEach((student) => {
    const seat = takeParityFirst(true); // prefer odd seats
    if (seat) assignment[seatKey(seat.row, seat.column)] = student._id.toString();
  });
  remainingGroups.forEach((student) => {
    const seat = takeSeat();
    if (seat) assignment[seatKey(seat.row, seat.column)] = student._id.toString();
  });

  return seatPositions.map((s) => ({
    row: s.row,
    column: s.column,
    student: assignment[seatKey(s.row, s.column)] || null,
  }));
}

module.exports = { generateAntiCheatSeats, shuffle };
