import { Suspense } from "react";
import { NewEventForm } from "@/components/events/NewEventForm";

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 max-w-2xl">Loading...</div>}>
      <NewEventForm />
    </Suspense>
  );
}
