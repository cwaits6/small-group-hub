"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, UserCog } from "lucide-react";
import type { AccessRequest, Profile, UserRole } from "@/lib/types";

export default function MembersPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: reqs }, { data: mems }] = await Promise.all([
      supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true }),
    ]);
    setRequests(reqs || []);
    setMembers(mems || []);
    setLoading(false);
  }

  async function handleRequest(id: string, action: "approved" | "denied") {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("access_requests")
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update request.");
      return;
    }

    if (action === "approved") {
      const request = requests.find((r) => r.id === id);
      if (request) {
        // Trigger welcome email via API
        await fetch("/api/admin/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: request.email, name: request.name }),
        });
      }
    }

    toast.success(`Request ${action}.`);
    loadData();
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update role.");
      return;
    }

    toast.success("Role updated.");
    loadData();
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-10">
        Manage Members
      </h1>

      <Tabs defaultValue="requests">
        <TabsList className="mb-6">
          <TabsTrigger value="requests" className="text-base px-6">
            Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="members" className="text-base px-6">
            Members ({members.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          {pendingRequests.length === 0 ? (
            <p className="text-lg text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold">{req.name}</p>
                        <p className="text-base text-muted-foreground">{req.email}</p>
                        {req.message && (
                          <p className="text-base mt-2 italic">&ldquo;{req.message}&rdquo;</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="lg"
                          className="bg-green-600 hover:bg-green-700 text-lg"
                          onClick={() => handleRequest(req.id, "approved")}
                        >
                          <Check className="mr-1 h-5 w-5" />
                          Approve
                        </Button>
                        <Button
                          size="lg"
                          variant="destructive"
                          className="text-lg"
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
          )}
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold">
                        {member.full_name || "Unnamed"}
                      </p>
                      <Badge
                        variant={
                          member.role === "admin"
                            ? "default"
                            : member.role === "member"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {member.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCog className="h-5 w-5 text-muted-foreground" />
                      <Select
                        defaultValue={member.role}
                        onValueChange={(v) =>
                          handleRoleChange(member.id, v as UserRole)
                        }
                      >
                        <SelectTrigger className="w-[140px] text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
