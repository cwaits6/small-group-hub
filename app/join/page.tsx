"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function JoinPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const message = formData.get("message") as string;

    const { error } = await supabase.from("access_requests").insert({
      name,
      email,
      message: message || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg text-center">
        <Card className="p-8">
          <CardContent className="pt-6">
            <h1 className="text-3xl font-bold text-amber-900 mb-4">Request Submitted!</h1>
            <p className="text-lg text-muted-foreground">
              Thank you for your interest in joining us. An admin will review your
              request and you&apos;ll receive an email once approved.
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
          <CardTitle className="text-3xl text-amber-900">Join Our Group</CardTitle>
          <CardDescription className="text-lg">
            Fill out the form below and an admin will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-lg">Full Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Your full name"
                className="text-lg py-6"
              />
            </div>
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
              <Label htmlFor="message" className="text-lg">
                Message <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Tell us a little about yourself..."
                rows={4}
                className="text-lg"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-amber-700 hover:bg-amber-800"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
