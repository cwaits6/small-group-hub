"use client";

import { useEffect, useRef } from "react";

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

export function LocationInput({ value, onChange, id }: LocationInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 25;
    let autocompleteEl: HTMLElement | null = null;
    let handler: ((event: Event) => void) | null = null;

    async function init() {
      while (!window.google?.maps?.places) {
        if (cancelled) return;
        attempts++;
        if (attempts >= maxAttempts) return;
        await new Promise((r) => setTimeout(r, 200));
      }

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
    <div
      ref={containerRef}
      className="[&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete]:h-8 [&_gmp-place-autocomplete]:rounded-lg [&_gmp-place-autocomplete]:border [&_gmp-place-autocomplete]:border-input [&_gmp-place-autocomplete]:bg-white [&_gmp-place-autocomplete]:!text-slate-800 [&_gmp-place-autocomplete_input]:!text-slate-800 [&_gmp-place-autocomplete_input]:text-base [&_gmp-place-autocomplete_input]:px-2.5 [&_gmp-place-autocomplete_input]:py-1"
    />
  );
}
