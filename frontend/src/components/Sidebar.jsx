import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/students", label: "Students" },
  { to: "/rooms", label: "Rooms" },
  { to: "/teachers", label: "Teachers" },
  { to: "/seating", label: "Seating Plan" },
  { to: "/results", label: "Results" },
  { to: "/progress-report", label: "Progress Report" },
  { to: "/faculties", label: "Faculties", adminOnly: true },
  { to: "/settings", label: "Settings", adminOnly: true },
  { to: "/users", label: "Users", adminOnly: true },
  { to: "/audit-log", label: "Audit Log", adminOnly: true },
  { to: "/my-account", label: "My Account" },
];

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <nav className="sidebar no-print">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">#</span>Examination Management System
      </div>
      <div className="sidebar__tagline">Exam Administration</div>
      {links
        .filter((link) => !link.adminOnly || isAdmin)
        .map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => "sidebar__link" + (isActive ? " active" : "")}
          >
            {link.label}
          </NavLink>
        ))}
      {user && (
        <div className="sidebar__user">
          <div className="sidebar__user-info">
            {user.username} · {user.role}
          </div>
          <button className="sidebar__logout" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
