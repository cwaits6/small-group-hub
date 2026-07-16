"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

interface SignInSecurityCardProps {
  currentEmail: string;
}

export function SignInSecurityCard({ currentEmail }: SignInSecurityCardProps) {
  const [newEmail, setNewEmail] = useState("");
  const [sending, setSending] = useState(false);
  const supabase = createClient();

  const handleEmailChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = normalizeEmail(newEmail);
    if (!email) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (email === currentEmail.toLowerCase()) {
      toast.error("That's already your email address.");
      return;
    }

    setSending(true);
    const { error } = await supabase.auth.updateUser({ email });
    setSending(false);

    if (error) {
      console.error(error);
      toast.error("Failed to start the email change. Please try again.");
      return;
    }

    setNewEmail("");
    toast.success(
      "Confirmation links sent. Check your old and new inboxes to finish the change.",
    );
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <h3>Sign in &amp; security</h3>

        <form onSubmit={handleEmailChange} className="space-y-2">
          <Label htmlFor="new_email" className="text-base">
            Email
          </Label>
          <p className="text-sm text-muted-foreground">
            You sign in as <strong>{currentEmail}</strong>. Enter a new email
            below and we&apos;ll send confirmation links to both addresses.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="new_email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new.email@example.com"
              className="py-5 text-base"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={sending || !newEmail}
              className="shrink-0"
            >
              <Mail className="mr-2 h-4 w-4" />
              {sending ? "Sending..." : "Change my email"}
            </Button>
          </div>
        </form>

        <Separator />

        <div className="space-y-2">
          <Label className="text-base">Password</Label>
          <div>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/update-password" />}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Change my password
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
