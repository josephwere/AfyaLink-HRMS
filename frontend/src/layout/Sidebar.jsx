
import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <h3 style={{padding:10}}>AfyaLink</h3>
      <Link to="/">Dashboard</Link>
      <Link to="/pharmacy">Pharmacy</Link>
      <Link to="/inventory">Inventory</Link>
      <Link to="/lab">Lab</Link>
      <Link to="/audit">Audit Logs</Link>
    </div>
  );
}
