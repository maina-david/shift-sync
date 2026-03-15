"use client";

import { memo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Users,
  MoreHorizontal,
  Send,
  Star,
  EyeOff,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AssignDialog } from "./assign-dialog";
import { shiftsApi, getErrorMessage } from "@/lib/api";
import { Shift } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface ShiftCardProps {
  shift: Shift;
  compact?: boolean;
}

const SKILL_STYLES: Record<string, string> = {
  bartender: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  "line cook": "bg-chart-warning/10 text-chart-warning border-chart-warning/20",
  server: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  host: "bg-chart-success/10 text-chart-success border-chart-success/20",
};

function tzAbbr(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function ShiftCardInner({ shift, compact = false }: ShiftCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);

  const assignedCount = shift.assignments.filter(
    (a) => a.status === "assigned" || a.status === "pending_swap",
  ).length;
  const isFull = assignedCount >= shift.headcount;
  const isManager = user?.role === "admin" || user?.role === "manager";
  const isPremium =
    ["5", "6"].includes(String(new Date(shift.date + "T00:00:00").getDay())) &&
    shift.startTime >= "17:00";

  const publishMutation = useMutation({
    mutationFn: () => shiftsApi.publish(shift.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift published");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => shiftsApi.unpublish(shift.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift unpublished");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const skillName = shift.requiredSkill?.name?.toLowerCase();
  const skillStyle = skillName
    ? (SKILL_STYLES[skillName] ??
      "bg-muted/40 text-muted-foreground border-border/50")
    : null;

  const isDraft = shift.status === "draft";

  return (
    <>
      <div
        className={cn(
          "group rounded-lg border p-3 space-y-2.5 transition-all duration-150",
          "hover:border-border hover:bg-muted/10",
          isDraft
            ? "border-dashed border-border/50 bg-muted/5"
            : "border-border/60 bg-card/40",
          isPremium &&
            !isDraft &&
            "border-chart-warning/20 bg-chart-warning/5 hover:bg-chart-warning/8",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold tabular-nums">
              {shift.startTime}–{shift.endTime}
            </span>
            {shift.isOvernight && (
              <span className="text-[0.625rem] font-medium text-muted-foreground">
                +1
              </span>
            )}
            {shift.location?.timezone && (
              <span className="text-[0.625rem] text-muted-foreground">
                {tzAbbr(shift.location.timezone)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isPremium && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center rounded-full border border-chart-warning/30 bg-chart-warning/10 p-0.5">
                    <Star className="h-2.5 w-2.5 text-chart-warning fill-chart-warning" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Premium shift (Fri/Sat evening)</TooltipContent>
              </Tooltip>
            )}

            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.625rem] font-medium capitalize",
                isDraft
                  ? "border-border/40 bg-muted/30 text-muted-foreground"
                  : "border-chart-success/20 bg-chart-success/10 text-chart-success",
              )}
            >
              {shift.status}
            </span>

            {isManager && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Shift options"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setAssignOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-2" /> Assign staff
                  </DropdownMenuItem>
                  {isDraft && (
                    <DropdownMenuItem
                      onClick={() => publishMutation.mutate()}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-2" />
                      )}
                      {publishMutation.isPending ? "Publishing…" : "Publish"}
                    </DropdownMenuItem>
                  )}
                  {!isDraft && (
                    <DropdownMenuItem
                      onClick={() => unpublishMutation.mutate()}
                      disabled={unpublishMutation.isPending}
                      className="text-muted-foreground focus:text-foreground"
                    >
                      {unpublishMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 mr-2" />
                      )}
                      {unpublishMutation.isPending
                        ? "Unpublishing…"
                        : "Unpublish"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {skillStyle && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              skillStyle,
            )}
          >
            {shift.requiredSkill!.name}
          </span>
        )}

        {shift.notes && !compact && (
          <div className="flex items-start gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
              {shift.notes}
            </p>
          </div>
        )}

        {!compact && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isFull ? "text-chart-success" : "text-muted-foreground",
                )}
              >
                {assignedCount}/{shift.headcount}
              </span>
            </div>
            <div className="flex -space-x-1.5">
              {shift.assignments
                .filter((a) => a.status === "assigned")
                .slice(0, 4)
                .map((a) => (
                  <Tooltip key={a.id}>
                    <TooltipTrigger>
                      <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[0.625rem] font-semibold text-primary ring-1 ring-background">
                        {a.staff.name[0].toUpperCase()}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{a.staff.name}</TooltipContent>
                  </Tooltip>
                ))}
            </div>
          </div>
        )}

        {isManager && !isFull && (
          <button
            onClick={() => setAssignOpen(true)}
            className="w-full h-7 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 flex items-center justify-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add staff
          </button>
        )}
      </div>

      <AssignDialog
        shift={shift}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </>
  );
}

export const ShiftCard = memo(
  ShiftCardInner,
  (prev, next) =>
    prev.shift.id === next.shift.id &&
    prev.shift.updatedAt === next.shift.updatedAt &&
    prev.shift.status === next.shift.status &&
    prev.compact === next.compact,
);
