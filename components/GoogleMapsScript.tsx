"use client";

import Script from "next/script";

export function GoogleMapsScript() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) return null;

  return (
    <Script
      id="google-maps-script"
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`}
      strategy="afterInteractive"
    />
  );
}
