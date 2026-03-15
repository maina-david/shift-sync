"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locationsApi, usersApi, shiftsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfWeek } from "date-fns";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export function SetupChecklist() {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("setup-checklist-dismissed") === "true";
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: locationsApi.list,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users", "setup"],
    queryFn: () => usersApi.list(),
  });

  const weekStart = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", "setup", weekStart],
    queryFn: () => shiftsApi.list({ startDate: weekStart }),
  });

  const managers = (users as any[]).filter(
    (u: any) => u.role === "manager" || u.role === "admin",
  );
  const publishedShifts = (shifts as any[]).filter(
    (s: any) => s.status === "published",
  );

  const items: ChecklistItem[] = [
    {
      id: "location",
      label: "Add your first location",
      description: "Set up at least one location to start scheduling.",
      href: "/locations",
      done: locations.length > 0,
    },
    {
      id: "manager",
      label: "Invite a manager",
      description: "Add a manager or admin who can create schedules.",
      href: "/staff",
      done: managers.length > 1,
    },
    {
      id: "staff",
      label: "Add staff members",
      description: "Invite the team members who will be scheduled.",
      href: "/staff",
      done: (users as any[]).filter((u: any) => u.role === "staff").length > 0,
    },
    {
      id: "schedule",
      label: "Create your first shift",
      description: "Draft and publish a shift to get started.",
      href: "/schedule",
      done: (shifts as any[]).length > 0,
    },
    {
      id: "publish",
      label: "Publish the schedule",
      description: "Notify staff of their upcoming shifts.",
      href: "/schedule",
      done: publishedShifts.length > 0,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem("setup-checklist-dismissed", "true");
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <p className="text-sm font-semibold">Setup checklist</p>
            <p className="text-xs text-muted-foreground">
              {doneCount} of {items.length} steps complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Progress pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/50 px-2.5 py-0.5 mr-2">
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(doneCount / items.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-primary tabular-nums">
              {Math.round((doneCount / items.length) * 100)}%
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-primary/10">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary/5",
                item.done && "opacity-60",
              )}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    item.done && "line-through text-muted-foreground",
                  )}
                >
                  {item.label}
                </p>
                {!item.done && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
