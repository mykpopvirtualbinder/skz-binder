"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { USER_TOUR_KEY, USER_TOUR_PATH, startUserTour } from "@/lib/user-tour";

export default function UserTourHost() {
  const pathname = usePathname();

  useEffect(() => {
    const id = sessionStorage.getItem(USER_TOUR_KEY);
    if (!id || !USER_TOUR_PATH[id]) return;
    if (pathname === "/guia") return;
    if (pathname !== USER_TOUR_PATH[id]) {
      sessionStorage.removeItem(USER_TOUR_KEY);
      return;
    }
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(USER_TOUR_KEY) !== id) return;
      sessionStorage.removeItem(USER_TOUR_KEY);
      startUserTour(id);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
