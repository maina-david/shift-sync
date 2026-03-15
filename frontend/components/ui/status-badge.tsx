"use client";

import { Badge } from "@/components/ui/badge";

const mix = (v: string, a: number) =>
  `color-mix(in oklch, var(${v}) ${a}%, transparent)`;

export function statusBadgeStyle(status: string): {
  background: string;
  color: string;
  borderColor: string;
} {
  switch (status) {
    case "pending":
    case "open":
      return {
        background: mix("--chart-warning", 15),
        color: "var(--chart-warning)",
        borderColor: mix("--chart-warning", 30),
      };
    case "accepted":
    case "claimed":
      return {
        background: mix("--chart-1", 15),
        color: "var(--chart-1)",
        borderColor: mix("--chart-1", 30),
      };
    case "approved":
      return {
        background: mix("--chart-success", 15),
        color: "var(--chart-success)",
        borderColor: mix("--chart-success", 30),
      };
    case "rejected":
    case "denied":
    case "cancelled":
      return {
        background: mix("--destructive", 15),
        color: "var(--destructive)",
        borderColor: mix("--destructive", 30),
      };
    default:
      return {
        background: "var(--muted)",
        color: "var(--muted-foreground)",
        borderColor: "var(--border)",
      };
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      style={statusBadgeStyle(status)}
      className="border text-xs capitalize"
    >
      {status}
    </Badge>
  );
}
