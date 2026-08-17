# Exam Seat Planning and Teacher Duty Management System

Built in phases. **Phases 1–3 are complete** (backend CRUD, seating algorithm, React frontend).

## What's included

```
exam-seat-system/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── models/
│   │   ├── Student.js             # name, roll (unique), subject
│   │   ├── Room.js                # name (unique), rows, columns (+ capacity virtual)
│   │   ├── Teacher.js             # name, subject
│   │   └── Seating.js             # room ref, rows, columns, seats[] {row, column, student}
│   ├── controllers/
│   │   ├── studentController.js
│   │   ├── roomController.js
│   │   ├── teacherController.js
│   │   └── seatingController.js   # generate / list / get / delete seating plans
│   ├── routes/
│   │   ├── studentRoutes.js
│   │   ├── roomRoutes.js
│   │   ├── teacherRoutes.js
│   │   └── seatingRoutes.js
│   ├── utils/
│   │   ├── asyncHandler.js        # avoids repetitive try/catch in controllers
│   │   └── errorHandler.js        # centralized error + 404 handling
│   ├── server.js                  # app entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js          # axios instance (VITE_API_URL)
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   └── SeatGrid.jsx       # renders a seating plan as a room layout
    │   ├── pages/
    │   │   ├── StudentsPage.jsx   # CRUD
    │   │   ├── RoomsPage.jsx      # CRUD
    │   │   ├── TeachersPage.jsx   # CRUD
    │   │   └── SeatingPage.jsx    # pick room -> Generate Seating -> view/delete history
    │   ├── App.jsx                # routes
    │   ├── main.jsx
    │   └── index.css              # design system (navy/brass exam-board theme)
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── .env.example
```

## How to run

**Backend:**
```bash
cd backend
cp .env.example .env      # edit MONGO_URI if needed
npm install
npm run dev                # or: npm start
```
Starts on `http://localhost:5000`. Requires a running MongoDB instance
(local `mongod` or a MongoDB Atlas connection string in `.env`).

**Frontend** (in a second terminal):
```bash
cd frontend
cp .env.example .env      # edit VITE_API_URL if backend runs elsewhere
npm install
npm run dev
```
Starts on `http://localhost:5173` and talks to the backend via `VITE_API_URL`.

## API Endpoints

All responses follow: `{ success: boolean, data / count / message }`

### Students — `/api/students`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/students` | Get all students |
| GET | `/api/students/:id` | Get one student |
| POST | `/api/students` | Create student — body: `{ name, roll, subject }` |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student |

### Rooms — `/api/rooms`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rooms` | Get all rooms |
| GET | `/api/rooms/:id` | Get one room |
| POST | `/api/rooms` | Create room — body: `{ name, rows, columns }` |
| PUT | `/api/rooms/:id` | Update room |
| DELETE | `/api/rooms/:id` | Delete room |

### Teachers — `/api/teachers`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/teachers` | Get all teachers |
| GET | `/api/teachers/:id` | Get one teacher |
| POST | `/api/teachers` | Create teacher — body: `{ name, subject }` |
| PUT | `/api/teachers/:id` | Update teacher |
| DELETE | `/api/teachers/:id` | Delete teacher |

### Seating — `/api/seating`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/seating/generate` | Generate a plan — body: `{ roomId, studentIds? }`. Fills seats row-wise (row 1 left-to-right, then row 2, ...). `studentIds` is optional; omit it to seat everyone, ordered by roll number. Errors if student count exceeds room capacity. |
| GET | `/api/seating` | List all saved seating plans (summary) |
| GET | `/api/seating/:id` | Get one plan, fully populated with student details |
| DELETE | `/api/seating/:id` | Delete a plan |

### Health check
`GET /api/health` → `{ success: true, message: "API is running" }`

## Quick test (after `npm run dev`)

```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Ram Thapa","roll":"10A-01","subject":"Science"}'

curl http://localhost:5000/api/students

curl -X POST http://localhost:5000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"Hall A","rows":4,"columns":5}'

curl -X POST http://localhost:5000/api/seating/generate \
  -H "Content-Type: application/json" \
  -d '{"roomId":"<room _id from above>"}'
```

## Frontend pages

- **Students / Rooms / Teachers** — each has an add/edit form plus a table with edit and delete actions.
- **Seating Plan** — pick a room from the dropdown, click **Generate Seating**, and the plan renders as a room layout (row letters down the left, seats laid out left-to-right, empty seats dashed). Previously generated plans are listed below and can be reopened or deleted.

---
**Next: Phase 4 — Smart Anti-Cheating Seating** (shuffle + keep same-subject students apart). Confirm Phases 1–3 work for you, then say "continue" or "go to Phase 4".
