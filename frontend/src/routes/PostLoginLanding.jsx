import { Navigate } from "react-router-dom";

/**
 * Landing for a signed-in (non-admin) user:
 * Navigates to the Stakeholder Portal Hub (/grm) where they can lodge complaints,
 * track complaints, and interact with the AI assistant.
 */
const PostLoginLanding = () => {
  return <Navigate to="/grm" replace />;
};

export default PostLoginLanding;
