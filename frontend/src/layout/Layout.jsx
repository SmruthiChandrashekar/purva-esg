import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Chatbot from "../components/Chatbot";
import { useAuth } from "../context/AuthProvider";

function Layout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAssistantPage = location.pathname === "/assistant";
  // The Puravankara website simulation pages bring their own header and footer.
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
    <div className="grm-ui">
      <Navbar />
      {/* Keyed by route so each navigation replays the enter transition */}
      <div key={location.pathname} className="page-transition">
        {children}
      </div>
      {!isAssistantPage && <Footer />}
      {!isAssistantPage && user && <Chatbot />}
    </div>
  );
}

export default Layout;
