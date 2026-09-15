"use client";

import type { ReactNode } from "react";
import AdSlot from "@/app/components/AdSlot";

type Props = {
  section: string;
  children: ReactNode;
  showMobileTop?: boolean;
  showMobileBottom?: boolean;
};

export default function AdRailLayout({
  section,
  children,
  showMobileTop = true,
  showMobileBottom = true,
}: Props) {
  return (
    <div className="ad-rail-layout">
      <aside className="ad-rail ad-rail-left">
        <AdSlot placement="sidebar_left" device="desktop" section={section} count={2} />
      </aside>

      <div className="ad-content-column">
        {showMobileTop && (
          <div className="ad-mobile-inline ad-mobile-inline-top">
            <AdSlot placement="mobile_inline_top" device="mobile" section={section} />
          </div>
        )}

        {children}

        <div className="ad-tablet-inline">
          <AdSlot placement="tablet_sidebar" device="tablet" section={section} />
        </div>

        {showMobileBottom && (
          <div className="ad-mobile-inline ad-mobile-inline-bottom">
            <AdSlot placement="mobile_inline_bottom" device="mobile" section={section} />
          </div>
        )}
      </div>

      <aside className="ad-rail ad-rail-right">
        <AdSlot placement="sidebar_right" device="desktop" section={section} count={2} />
      </aside>
    </div>
  );
}
