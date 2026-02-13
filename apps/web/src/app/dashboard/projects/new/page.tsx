"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [errors, setErrors] = useState<{ name?: string; domain?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation matching CreateProjectSchema
    const newErrors: { name?: string; domain?: string } = {};

    if (!name.trim() || name.length > 100) {
      newErrors.name = "Name is required and must be 100 characters or fewer.";
    }

    if (!domain.trim()) {
      newErrors.domain = "Domain is required.";
    } else {
      // Validate URL format (auto-prepend https:// like the schema does)
      const normalized =
        domain.startsWith("http://") || domain.startsWith("https://")
          ? domain
          : `https://${domain}`;
      try {
        new URL(normalized);
      } catch {
        newErrors.domain = "Please enter a valid domain (e.g. example.com).";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    // TODO: Call API to create project
    // const response = await apiClient.post("/projects", { name, domain });
    // router.push(`/dashboard/projects/${response.id}`);

    // For now, redirect back to the projects list
    router.push("/dashboard/projects");
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
          <CardDescription>
            Add a website to audit for AI-readiness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="My Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Domain field */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                type="text"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              {errors.domain && (
                <p className="text-sm text-destructive">{errors.domain}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the root domain to audit. https:// will be added
                automatically if omitted.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
