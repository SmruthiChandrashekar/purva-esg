import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Chatbot from "../components/Chatbot";
import ScrollToTop from "../components/ScrollToTop";
import { useAuth } from "../context/AuthProvider";

function Layout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAssistantPage = location.pathname === "/assistant";
  return (
    // app-shell fills the screen and pushes the footer to the bottom, so pages don't need
    // their own "min-height: 80vh" and short pages have no empty gap above the footer.
    <div className={`grm-ui app-shell${isAssistantPage ? " is-assistant" : ""}`}>
      <ScrollToTop />
      <Navbar />
      {/* Keyed by route so each navigation replays the enter transition */}
      <main key={location.pathname} className="app-main page-transition">
        {children}
      </main>
      {!isAssistantPage && <Footer />}
      {!isAssistantPage && user && <Chatbot />}
    </div>
  );
}

export default Layout;
