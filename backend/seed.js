// Populates a fresh database with a small set of sample data for local
// development or testing. Safe to re-run — it only inserts if the relevant
// collection is currently empty, so it won't duplicate data.
require("dotenv").config();
const mongoose = require("mongoose");
const Student = require("./models/Student");
const Room = require("./models/Room");
const Teacher = require("./models/Teacher");
const User = require("./models/User");
const Faculty = require("./models/Faculty");
const { hashPassword } = require("./utils/passwordUtils");

const SAMPLE_ROOMS = [
  { name: "Hall A", rows: 4, columns: 5 },
  { name: "Hall B", rows: 4, columns: 5 },
];

const SAMPLE_TEACHERS = [
  { name: "Sita Gurung", subject: "Mathematics" },
  { name: "Ram Thapa", subject: "Physics" },
  { name: "Anita Rai", subject: "English" },
];

const SAMPLE_STUDENT_NAMES = [
  "Aarav Sharma", "Bibek Karki", "Cheshta Basnet", "Dipesh Adhikari",
  "Esha Poudel", "Farhan Khan", "Gita Shrestha", "Hari Bhandari",
];

// Without these, no marks can ever be entered for any student — the whole
// ledger/results system looks up a student's subjects via their faculty's
// configuration, and throws if that faculty isn't set up yet.
const DEFAULT_FACULTIES = [
  {
    name: "Management",
    compulsorySubjects: ["Accounting", "English", "Nepali", "Computer", "Social Studies", "Economics"],
    electiveGroupName: "",
    electiveOptions: [],
  },
  {
    name: "Science",
    compulsorySubjects: ["English", "Maths", "Physics", "Chemistry", "Nepali"],
    electiveGroupName: "Science Elective",
    electiveOptions: ["Biology", "Computer"],
  },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected — seeding...");

  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
    await User.create({ username: "admin", passwordHash: hashPassword(adminPassword), role: "admin" });
    console.log(`Created initial admin user — username: admin, password: ${adminPassword}`);
    console.log("Log in and change this password immediately (Settings > My Account).");
  } else {
    console.log("Users already exist — skipped");
  }

  const roomCount = await Room.countDocuments();
  if (roomCount === 0) {
    await Room.insertMany(SAMPLE_ROOMS);
    console.log(`Inserted ${SAMPLE_ROOMS.length} rooms`);
  } else {
    console.log("Rooms already exist — skipped");
  }

  const facultyCount = await Faculty.countDocuments();
  if (facultyCount === 0) {
    await Faculty.insertMany(DEFAULT_FACULTIES);
    console.log(`Inserted ${DEFAULT_FACULTIES.length} default faculties (Management, Science)`);
  } else {
    console.log("Faculties already exist — skipped");
  }

  const teacherCount = await Teacher.countDocuments();
  if (teacherCount === 0) {
    await Teacher.insertMany(SAMPLE_TEACHERS);
    console.log(`Inserted ${SAMPLE_TEACHERS.length} teachers`);
  } else {
    console.log("Teachers already exist — skipped");
  }

  const studentCount = await Student.countDocuments();
  if (studentCount === 0) {
    let seq = 7001;
    const students = SAMPLE_STUDENT_NAMES.map((name, i) => ({
      name,
      faculty: i % 2 === 0 ? "Science" : "Management",
      studentClass: i % 3 === 0 ? "12" : "11",
      optionalSubject: i % 2 === 0 ? (i % 4 === 0 ? "Biology" : "Computer") : "",
      batchYear: 2081,
      roll: `81-${seq++}`,
    }));
    await Student.insertMany(students);
    console.log(`Inserted ${students.length} students`);
  } else {
    console.log("Students already exist — skipped");
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
