"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast.error("Invalid email or password.");
      return;
    }

    router.replace(redirect);
    router.refresh();
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">Sign In</CardTitle>
          <CardDescription className="text-lg">
            Enter your email and password to sign in.
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-lg">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Your password"
                className="text-lg py-6"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-brand-primary hover:bg-brand-primary/90 text-white"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="text-center mt-6 space-y-2">
            <p className="text-base text-muted-foreground">
              <Link href="/forgot-password" className="text-brand-primary hover:underline font-medium">
                Forgot your password?
              </Link>
            </p>
            <p className="text-base text-muted-foreground">
              Not a member yet?{" "}
              <Link href="/join" className="text-brand-primary hover:underline font-medium">
                Request to join
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
