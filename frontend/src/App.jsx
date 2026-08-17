import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import LoginGate from "./components/LoginGate";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import RoomsPage from "./pages/RoomsPage";
import TeachersPage from "./pages/TeachersPage";
import SeatingPage from "./pages/SeatingPage";
import ResultsPage from "./pages/ResultsPage";
import ProgressReportPage from "./pages/ProgressReportPage";
import AuditLogPage from "./pages/AuditLogPage";
import UsersPage from "./pages/UsersPage";
import FacultiesPage from "./pages/FacultiesPage";
import SettingsPage from "./pages/SettingsPage";
import PublicResultPage from "./pages/PublicResultPage";
import MyAccountPage from "./pages/MyAccountPage";

// The admin-facing app: sidebar + every internal page, gated behind login.
function AdminApp() {
  return (
    <LoginGate>
      <div className="app-shell">
        <Sidebar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/seating" element={<SeatingPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/progress-report" element={<ProgressReportPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/faculties" element={<FacultiesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/my-account" element={<MyAccountPage />} />
        </Routes>
      </div>
    </LoginGate>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public, unauthenticated — anyone with the link can look up a result */}
      <Route path="/check-result" element={<PublicResultPage />} />
      {/* Everything else is the admin app, behind login */}
      <Route path="/*" element={<AdminApp />} />
    </Routes>
  );
}
