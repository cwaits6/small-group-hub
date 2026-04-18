"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (lib: string) => Promise<any>;
        places?: {
          PlaceAutocompleteElement: new (opts?: any) => HTMLElement & { id: string; addEventListener: (type: string, handler: any) => void; removeEventListener: (type: string, handler: any) => void };
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
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleManualChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeRef.current(e.target.value);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 25; // ~5 seconds of polling
    let autocompleteEl: HTMLElement | null = null;
    let handler: ((event: Event) => void) | null = null;

    async function init() {
      // Wait for google.maps to be available with retry cap
      while (!window.google?.maps?.places) {
        if (cancelled) return;
        attempts++;
        if (attempts >= maxAttempts) {
          return; // Give up — manual input remains available
        }
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
      autocompleteEl = placeAutocomplete;

      handler = async (event: Event) => {
        const e = event as Event & { place?: { fetchFields: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string } };
        const place = e.place;
        if (place) {
          await place.fetchFields({ fields: ["formattedAddress"] });
          if (place.formattedAddress) {
            onChangeRef.current(place.formattedAddress);
          }
        }
      };

      placeAutocomplete.addEventListener("gmp-select", handler);
      containerRef.current.appendChild(placeAutocomplete);
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
      if (autocompleteEl && handler) {
        autocompleteEl.removeEventListener("gmp-select", handler);
      }
      if (autocompleteEl && containerRef.current?.contains(autocompleteEl)) {
        containerRef.current.removeChild(autocompleteEl);
      }
      initializedRef.current = false;
    };
  }, [id]);

  return (
    <div>
      {/* Manual text input — always visible so users can type non-Google addresses */}
      <input
        type="text"
        value={value}
        onChange={handleManualChange}
        autoComplete="off"
        placeholder="Enter a location..."
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
          className
        )}
      />
      {/* Google Places autocomplete element — renders below the manual input */}
      <div
        ref={containerRef}
        className={cn(
          "[&_gmp-place-autocomplete]:w-full mt-1",
          !ready && "hidden"
        )}
      />
      {ready && value && (
        <p className="mt-1 text-sm text-muted-foreground truncate">{value}</p>
      )}
    </div>
  );
}
