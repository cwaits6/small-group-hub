"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Attendee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status: string;
}

interface AttendeeListProps {
  attendees: Attendee[];
}

function getInitials(first: string | null, last: string | null): string {
  const f = first?.[0] ?? "";
  const l = last?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function AttendeeGroup({
  label,
  people,
}: {
  label: string;
  people: Attendee[];
}) {
  if (people.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {label} ({people.length})
      </h3>
      <div className="flex flex-wrap gap-3">
        {people.map((person) => (
          <div key={person.id} className="flex items-center gap-2">
            <Avatar size="default">
              {person.avatar_url && (
                <AvatarImage src={person.avatar_url} alt={`${person.first_name} ${person.last_name}`} />
              )}
              <AvatarFallback>
                {getInitials(person.first_name, person.last_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-700">
              {[person.first_name, person.last_name].filter(Boolean).join(" ") || "Member"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendeeList({ attendees }: AttendeeListProps) {
  const going = attendees.filter((a) => a.status === "yes");
  const maybe = attendees.filter((a) => a.status === "maybe");

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-slate-700">Who&apos;s coming</h2>
      <AttendeeGroup label="Going" people={going} />
      <AttendeeGroup label="Maybe" people={maybe} />
    </div>
  );
}
