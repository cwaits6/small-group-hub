"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEAD_OPTIONS = ["5", "15", "30", "60"] as const;

const LEAD_LABELS: Record<string, string> = {
  "5": "5 minutes",
  "15": "15 minutes",
  "30": "30 minutes",
  "60": "1 hour",
};

interface MeetingFieldsSectionProps {
  meetingUrl: string;
  onMeetingUrlChange: (v: string) => void;
  meetingId: string;
  onMeetingIdChange: (v: string) => void;
  passcode: string;
  onPasscodeChange: (v: string) => void;
  showOnDashboard: boolean;
  onShowOnDashboardChange: (v: boolean) => void;
  leadMinutes: string;
  onLeadMinutesChange: (v: string) => void;
  isRecurring: boolean;
}

export function MeetingFieldsSection({
  meetingUrl,
  onMeetingUrlChange,
  meetingId,
  onMeetingIdChange,
  passcode,
  onPasscodeChange,
  showOnDashboard,
  onShowOnDashboardChange,
  leadMinutes,
  onLeadMinutesChange,
  isRecurring,
}: MeetingFieldsSectionProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div>
        <Label className="text-lg">Meeting</Label>
        <p className="text-sm text-muted-foreground">
          {isRecurring
            ? "Set once — the Join button uses it for every date in this series."
            : "Members get a time-aware Join button on the dashboard and event page."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting_url" className="text-lg">Meeting link</Label>
        <Input
          id="meeting_url"
          type="url"
          placeholder="https://us02web.zoom.us/j/…"
          value={meetingUrl}
          onChange={(e) => onMeetingUrlChange(e.target.value)}
          className="text-lg py-6"
        />
        <p className="text-sm text-muted-foreground">
          Use the invite link with the passcode embedded so one tap joins.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="meeting_id" className="text-lg">Meeting ID</Label>
          <Input
            id="meeting_id"
            value={meetingId}
            onChange={(e) => onMeetingIdChange(e.target.value)}
            className="text-lg py-6"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meeting_passcode" className="text-lg">Passcode</Label>
          <Input
            id="meeting_passcode"
            value={passcode}
            onChange={(e) => onPasscodeChange(e.target.value)}
            className="text-lg py-6"
          />
        </div>
      </div>

      {meetingUrl.trim() && (
        <>
          <div className="flex items-center gap-3">
            <Switch
              id="meeting_show_on_dashboard"
              checked={showOnDashboard}
              onCheckedChange={onShowOnDashboardChange}
            />
            <Label htmlFor="meeting_show_on_dashboard" className="text-lg">
              Show join button on dashboard
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-lg">Join opens before start</Label>
            <Select
              value={leadMinutes}
              onValueChange={(v) => {
                if (v) onLeadMinutesChange(v);
              }}
            >
              <SelectTrigger className="w-full text-lg py-6">
                <SelectValue>{LEAD_LABELS[leadMinutes] ?? `${leadMinutes} minutes`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LEAD_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {LEAD_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
