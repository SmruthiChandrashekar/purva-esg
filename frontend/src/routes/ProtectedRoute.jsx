import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

const ProtectedRoute = ({ children, allowGuest = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isGuest = sessionStorage.getItem("isGuest") === "true";

  if (loading) return <div>Loading...</div>;

  if (!user && !(allowGuest && isGuest)) {
    return <Navigate to={`/login${location.search}`} replace />;
  }

  return children;
};

export default ProtectedRoute;