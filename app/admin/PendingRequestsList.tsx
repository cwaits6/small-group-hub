"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export interface PendingRequest {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface PendingRequestsListProps {
  initialRequests: PendingRequest[];
}

export function PendingRequestsList({ initialRequests }: PendingRequestsListProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  async function handleRequest(id: string, action: "approved" | "denied") {
    setBusyId(id);
    try {
      if (action === "approved") {
        const request = requests.find((r) => r.id === id);
        if (request) {
          const res = await fetch("/api/admin/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: request.email, name: request.name }),
          });
          if (!res.ok) {
            toast.error("Failed to approve request.");
            return;
          }
        }
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Session expired. Please log in again.");
          return;
        }
        const { error } = await supabase
          .from("access_requests")
          .update({
            status: action,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          toast.error("Failed to update request.");
          return;
        }
      }

      toast.success(`Request ${action}.`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-lg text-muted-foreground">All caught up.</p>;
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <Card key={req.id}>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xl font-semibold">{req.name}</p>
                <p className="text-base text-muted-foreground">{req.email}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Requested access {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="lg"
                  className="bg-brand-primary hover:bg-brand-primary/90 text-lg"
                  disabled={busyId === req.id}
                  onClick={() => handleRequest(req.id, "approved")}
                >
                  <Check className="mr-1 h-5 w-5" />
                  Approve
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="text-lg"
                  disabled={busyId === req.id}
                  onClick={() => handleRequest(req.id, "denied")}
                >
                  <X className="mr-1 h-5 w-5" />
                  Deny
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
