"use client";

import dynamic from "next/dynamic";

export const EventCalendarView = dynamic(
  () => import("./EventCalendarView.impl"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-[2rem] border-2 border-border overflow-hidden p-5 shadow-sm">
        <div className="h-[560px] rounded-[1.5rem] border border-slate-100 bg-slate-50/70 animate-pulse" />
      </div>
    ),
  },
);
