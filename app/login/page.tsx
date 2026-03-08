"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg text-center">
        <Card className="p-8">
          <CardContent className="pt-6">
            <h1 className="text-3xl font-bold text-amber-900 mb-4">Check Your Email</h1>
            <p className="text-lg text-muted-foreground">
              We sent you a magic link. Click the link in the email to sign in.
              It may take a minute to arrive.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">Sign In</CardTitle>
          <CardDescription className="text-lg">
            Enter your email and we&apos;ll send you a magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-lg">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="your@email.com"
                className="text-lg py-6"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-amber-700 hover:bg-amber-800"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
          <p className="text-center text-base text-muted-foreground mt-6">
            Not a member yet?{" "}
            <Link href="/join" className="text-amber-700 hover:underline font-medium">
              Request to join
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
