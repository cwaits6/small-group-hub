"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (lib: string) => Promise<any>;
        places?: {
          PlaceAutocompleteElement: new (opts?: any) => HTMLElement & { id: string; addEventListener: (type: string, handler: any) => void };
        };
      };
    };
  }
}

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
}

export function LocationInput({ value, onChange, className, id }: LocationInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Wait for google.maps to be available
      while (!window.google?.maps?.places) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 200));
      }

      // Import the places library (required with loading=async)
      await window.google.maps.importLibrary("places");

      if (cancelled || initializedRef.current || !containerRef.current) return;
      initializedRef.current = true;

      const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: "us" },
      });

      placeAutocomplete.id = id || "location-autocomplete";

      placeAutocomplete.addEventListener("gmp-placeselect", async (event: Event) => {
        const e = event as Event & { place?: { fetchFields: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string } };
        const place = e.place;
        if (place) {
          await place.fetchFields({ fields: ["formattedAddress"] });
          if (place.formattedAddress) {
            onChange(place.formattedAddress);
          }
        }
      });

      containerRef.current.appendChild(placeAutocomplete);
      setReady(true);
    }

    init();
    return () => { cancelled = true; };
  }, [id, onChange]);

  return (
    <div>
      {/* Fallback text input shown until the autocomplete element loads, or if API fails */}
      {!ready && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          placeholder="Enter a location..."
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
            className
          )}
        />
      )}
      <div
        ref={containerRef}
        className={cn(
          "[&_gmp-placeautocomplete]:w-full",
          !ready && "hidden"
        )}
      />
      {/* Hidden input to preserve the selected value for form submission */}
      {ready && value && (
        <p className="mt-1 text-sm text-muted-foreground truncate">{value}</p>
      )}
    </div>
  );
}
