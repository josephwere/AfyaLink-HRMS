import { NAV_BY_ROLE } from "../config/navByRole";
import { useAuth } from "../auth/useAuth";

export default function RoleNav() {
  const { user } = useAuth();
  const items = NAV_BY_ROLE[user.role] || [];

  return (
    <nav>
      {items.map((i) => (
        <a key={i} href={`/${i.toLowerCase()}`}>
          {i}
        </a>
      ))}
    </nav>
  );
}
