// frontend/src/components/RoleNav.jsx
import { Link } from "react-router-dom";
import { NAV_BY_ROLE } from "../config/navByRole";
import { useAuth } from "../utils/auth";

export default function RoleNav() {
  const { user } = useAuth();
  const items = NAV_BY_ROLE[user.role] || [];

  return (
    <nav>
      {items.map((i) => (
        <Link key={i} to={`/${i.toLowerCase()}`}>
          {i}
        </Link>
      ))}
    </nav>
  );
}
