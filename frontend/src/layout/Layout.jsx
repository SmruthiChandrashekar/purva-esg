import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Chatbot from "../components/Chatbot";
import { useAuth } from "../context/AuthProvider";

function Layout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAssistantPage = location.pathname === "/assistant";
  const isSimulation =
    location.pathname === "/" ||
    location.pathname.startsWith("/purva") ||
    location.pathname.startsWith("/simulation") ||
    location.pathname.startsWith("/residential") ||
    location.pathname.startsWith("/bengaluru");

  if (isSimulation) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {children}
      {!isAssistantPage && <Footer />}
      {!isAssistantPage && user && <Chatbot />}
    </>
  );
}

export default Layout;