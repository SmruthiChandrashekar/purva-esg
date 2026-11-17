import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Every page opens at the top. Without this the browser kept the previous page's scroll
 * position, so on phones (seen on a foldable in the office test) a short page opened from
 * a long one landed on the footer. "instant" overrides Bootstrap's smooth scrolling, which
 * otherwise animates the jump.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
