const Faculty = require("../models/Faculty");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Get all faculties. Auto-seeds the original Management/Science
//          definitions on first run so existing data keeps working without
//          a manual migration step.
// @route   GET /api/faculties
const getFaculties = asyncHandler(async (req, res) => {
  const count = await Faculty.countDocuments();
  if (count === 0) {
    await Faculty.insertMany([
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
    ]);
  }

  const faculties = await Faculty.find().sort({ name: 1 });
  res.status(200).json({ success: true, count: faculties.length, data: faculties });
});

// @desc    Create a new faculty — this is how a school adds e.g. Humanities
//          or Law without any code changes.
// @route   POST /api/faculties
// @body    { name, compulsorySubjects: [...], electiveGroupName?, electiveOptions? }
const createFaculty = asyncHandler(async (req, res) => {
  const { name, compulsorySubjects, electiveGroupName, electiveOptions } = req.body;
  const faculty = await Faculty.create({
    name,
    compulsorySubjects: compulsorySubjects || [],
    electiveGroupName: electiveGroupName || "",
    electiveOptions: electiveOptions || [],
  });
  res.status(201).json({ success: true, data: faculty });
});

// @desc    Update a faculty's subject structure
// @route   PUT /api/faculties/:id
const updateFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!faculty) {
    return res.status(404).json({ success: false, message: "Faculty not found" });
  }
  res.status(200).json({ success: true, data: faculty });
});

// @desc    Delete a faculty — blocked if any student currently belongs to it
// @route   DELETE /api/faculties/:id
const deleteFaculty = asyncHandler(async (req, res) => {
  const Student = require("../models/Student");
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) {
    return res.status(404).json({ success: false, message: "Faculty not found" });
  }
  const inUse = await Student.exists({ faculty: faculty.name, archived: false });
  if (inUse) {
    return res.status(400).json({
      success: false,
      message: "Students are still enrolled in this faculty. Move or archive them first.",
    });
  }
  await faculty.deleteOne();
  res.status(200).json({ success: true, data: {} });
});

module.exports = { getFaculties, createFaculty, updateFaculty, deleteFaculty };
