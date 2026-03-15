"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle,
  XCircle,
  MoreHorizontal,
  AlertTriangle,
  ArrowLeftRight,
  HandHelping,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import {
  swapRequestsApi,
  dropRequestsApi,
  shiftsApi,
  usersApi,
  getErrorMessage,
} from "@/lib/api";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { SwapRequest, DropRequest, Shift, User } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function SwapRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewSwap, setReviewSwap] = useState<{
    id: string;
    action: "approve" | "deny";
  } | null>(null);
  const [reviewDrop, setReviewDrop] = useState<{
    id: string;
    action: "approve" | "reject";
  } | null>(null);
  const [managerNote, setManagerNote] = useState("");
  const [confirm, setConfirm] = useState<{
    id: string;
    action: string;
    label: string;
  } | null>(null);

  // 3-step swap creation (staff only)
  const [swapStep, setSwapStep] = useState(0); // 0=closed, 1=pick shift, 2=pick partner, 3=confirm
  const [newSwapShiftId, setNewSwapShiftId] = useState("");
  const [newSwapAssignmentId, setNewSwapAssignmentId] = useState("");
  const [newSwapPartnerId, setNewSwapPartnerId] = useState("");
  const [newSwapReason, setNewSwapReason] = useState("");

  const { data: swaps = [], isLoading: swapsLoading } = useQuery<SwapRequest[]>(
    {
      queryKey: ["swap-requests"],
      queryFn: swapRequestsApi.list,
    },
  );

  const today = format(new Date(), "yyyy-MM-dd");
  const twoWeeksOut = format(addDays(new Date(), 14), "yyyy-MM-dd");
  const isManager = user?.role === "admin" || user?.role === "manager";

  const { data: myShifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts", "upcoming", today, twoWeeksOut],
    queryFn: () => shiftsApi.list({ startDate: today, endDate: twoWeeksOut }),
    enabled: !isManager && swapStep >= 1,
  });

  const { data: colleagues = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
    enabled: !isManager && swapStep >= 2,
  });

  const myEligibleShifts = myShifts.filter(
    (s) =>
      s.status === "published" &&
      s.assignments.some(
        (a) => a.staffId === user?.id && a.status === "assigned",
      ),
  );

  const selectedShift = myEligibleShifts.find((s) => s.id === newSwapShiftId);
  const eligiblePartners = colleagues.filter(
    (c) => c.id !== user?.id && c.role === "staff" && c.isActive,
  );

  const createSwapMutation = useMutation({
    mutationFn: () =>
      swapRequestsApi.create({
        fromAssignmentId: newSwapAssignmentId,
        toUserId: newSwapPartnerId,
        reason: newSwapReason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      toast.success("Swap request sent");
      setSwapStep(0);
      setNewSwapShiftId("");
      setNewSwapAssignmentId("");
      setNewSwapPartnerId("");
      setNewSwapReason("");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: drops = [], isLoading: dropsLoading } = useQuery<DropRequest[]>(
    {
      queryKey: ["drop-requests"],
      queryFn: dropRequestsApi.list,
    },
  );

  const swapMutation = useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: "approve" | "deny" | "accept" | "reject";
      note?: string;
    }) =>
      action === "approve"
        ? swapRequestsApi.approve(id, note)
        : action === "deny"
          ? swapRequestsApi.deny(id, note)
          : action === "accept"
            ? swapRequestsApi.accept(id)
            : swapRequestsApi.reject(id),
    onMutate: ({ id, action }) => {
      const statusMap: Record<string, SwapRequest["status"]> = {
        approve: "approved",
        deny: "denied",
        accept: "accepted",
        reject: "rejected",
      };
      const prev = queryClient.getQueryData<SwapRequest[]>(["swap-requests"]);
      queryClient.setQueryData<SwapRequest[]>(["swap-requests"], (old = []) =>
        old.map((s) => (s.id === id ? { ...s, status: statusMap[action] } : s)),
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      toast.success("Done");
      setReviewSwap(null);
      setManagerNote("");
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["swap-requests"], ctx.prev);
      toast.error(getErrorMessage(err));
    },
  });

  const dropMutation = useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: "claim" | "approve" | "cancel" | "reject";
      note?: string;
    }) =>
      action === "claim"
        ? dropRequestsApi.claim(id)
        : action === "approve"
          ? dropRequestsApi.approve(id, note)
          : action === "cancel"
            ? dropRequestsApi.cancel(id)
            : dropRequestsApi.reject(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drop-requests"] });
      toast.success("Done");
      setReviewDrop(null);
      setManagerNote("");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const myPendingSwaps = swaps.filter(
    (s) => s.status === "pending" && s.fromAssignment?.staffId === user?.id,
  ).length;
  const myOpenDrops = drops.filter(
    (d) => d.status === "open" && d.assignment?.staffId === user?.id,
  ).length;
  const myPendingTotal = myPendingSwaps + myOpenDrops;

  const swapColumns: ColumnDef<SwapRequest>[] = [
    {
      id: "shift",
      header: "Shift",
      cell: ({ row }) => {
        const s = row.original.fromAssignment?.shift;
        return s ? (
          <div>
            <p className="font-medium text-sm">{s.location?.name}</p>
            <p className="text-xs text-muted-foreground">
              {s.date} · {s.startTime}–{s.endTime}
            </p>
          </div>
        ) : (
          "—"
        );
      },
    },
    {
      id: "from",
      header: "From",
      cell: ({ row }) => row.original.fromAssignment?.staff?.name ?? "—",
    },
    {
      id: "to",
      header: "To",
      cell: ({ row }) => row.original.toUser?.name ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const swap = row.original;
        const canManagerAct = isManager && swap.status === "accepted";
        const canTargetAct =
          !isManager && swap.status === "pending" && swap.toUserId === user?.id;
        const canRequesterCancel =
          !isManager &&
          ["pending", "accepted"].includes(swap.status) &&
          swap.fromAssignment?.staffId === user?.id;

        if (!canManagerAct && !canTargetAct && !canRequesterCancel) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Request actions"
                className="h-8 w-8"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManagerAct && (
                <>
                  <DropdownMenuItem
                    className="text-chart-success focus:text-chart-success"
                    onClick={() => {
                      setManagerNote("");
                      setReviewSwap({ id: swap.id, action: "approve" });
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setManagerNote("");
                      setReviewSwap({ id: swap.id, action: "deny" });
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Deny
                  </DropdownMenuItem>
                </>
              )}
              {canTargetAct && (
                <>
                  <DropdownMenuItem
                    className="text-chart-success focus:text-chart-success"
                    onClick={() =>
                      swapMutation.mutate({ id: swap.id, action: "accept" })
                    }
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Accept
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      setConfirm({
                        id: swap.id,
                        action: "reject",
                        label: "Reject this swap request?",
                      })
                    }
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </DropdownMenuItem>
                </>
              )}
              {canRequesterCancel && (
                <>
                  {(canManagerAct || canTargetAct) && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="text-muted-foreground focus:text-foreground"
                    onClick={() =>
                      setConfirm({
                        id: swap.id,
                        action: "cancel",
                        label: "Cancel this swap request?",
                      })
                    }
                  >
                    Cancel request
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const dropColumns: ColumnDef<DropRequest>[] = [
    {
      id: "shift",
      header: "Shift",
      cell: ({ row }) => {
        const s = row.original.assignment?.shift;
        return s ? (
          <div>
            <p className="font-medium text-sm">{s.location?.name}</p>
            <p className="text-xs text-muted-foreground">
              {s.date} · {s.startTime}–{s.endTime}
            </p>
          </div>
        ) : (
          "—"
        );
      },
    },
    {
      id: "original",
      header: "Original staff",
      cell: ({ row }) => row.original.assignment?.staff?.name ?? "—",
    },
    {
      id: "claimedBy",
      header: "Claimed by",
      cell: ({ row }) => row.original.claimedBy?.name ?? "—",
    },
    {
      id: "expires",
      header: "Expires",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.expiresAt), "MMM d HH:mm")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const drop = row.original;
        const canManagerAct = isManager && drop.status === "claimed";
        const canClaim =
          !isManager &&
          drop.status === "open" &&
          drop.assignment?.staffId !== user?.id;
        const canCancel =
          !isManager &&
          drop.status === "open" &&
          drop.assignment?.staffId === user?.id;

        if (!canManagerAct && !canClaim && !canCancel) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Request actions"
                className="h-8 w-8"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManagerAct && (
                <>
                  <DropdownMenuItem
                    className="text-chart-success focus:text-chart-success"
                    onClick={() => {
                      setManagerNote("");
                      setReviewDrop({ id: drop.id, action: "approve" });
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setManagerNote("");
                      setReviewDrop({ id: drop.id, action: "reject" });
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </DropdownMenuItem>
                </>
              )}
              {canClaim && (
                <DropdownMenuItem
                  className="text-primary focus:text-primary"
                  onClick={() =>
                    dropMutation.mutate({ id: drop.id, action: "claim" })
                  }
                >
                  Claim shift
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem
                  className="text-muted-foreground focus:text-foreground"
                  onClick={() =>
                    setConfirm({
                      id: drop.id,
                      action: "drop-cancel",
                      label: "Cancel this drop request?",
                    })
                  }
                >
                  Cancel request
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Swap & Drop Requests
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage shift swap and drop requests
          </p>
        </div>
        {!isManager && (
          <Button
            size="sm"
            onClick={() => setSwapStep(1)}
            disabled={myPendingTotal >= 3}
          >
            <Plus className="h-4 w-4 mr-2" />
            Request Swap
          </Button>
        )}
      </div>

      {!isManager && myPendingTotal >= 3 && (
        <div className="flex items-start gap-3 rounded-lg border border-chart-warning/30 bg-chart-warning/8 px-4 py-3 text-sm text-chart-warning">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            You have {myPendingTotal} pending request
            {myPendingTotal > 1 ? "s" : ""} — you've reached the maximum of 3.
            Cancel an existing request before creating a new one.
          </span>
        </div>
      )}

      <Tabs defaultValue="swaps">
        <TabsList>
          <TabsTrigger value="swaps">
            Swaps
            {swaps.filter((s) => ["pending", "accepted"].includes(s.status))
              .length > 0 && (
              <Badge className="ml-2 bg-chart-warning/20 text-chart-warning border-chart-warning/30 border text-xs px-1.5 py-0">
                {
                  swaps.filter((s) =>
                    ["pending", "accepted"].includes(s.status),
                  ).length
                }
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="drops">
            Drops
            {drops.filter((d) => ["open", "claimed"].includes(d.status))
              .length > 0 && (
              <Badge className="ml-2 bg-chart-warning/20 text-chart-warning border-chart-warning/30 border text-xs px-1.5 py-0">
                {
                  drops.filter((d) => ["open", "claimed"].includes(d.status))
                    .length
                }
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swaps" className="mt-4">
          <DataTable
            columns={swapColumns}
            data={swaps}
            isLoading={swapsLoading}
            emptyState={
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ArrowLeftRight />
                  </EmptyMedia>
                  <EmptyTitle>No swap requests</EmptyTitle>
                  <EmptyDescription>
                    Shift swap requests between team members will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </TabsContent>
        <TabsContent value="drops" className="mt-4">
          <DataTable
            columns={dropColumns}
            data={drops}
            isLoading={dropsLoading}
            emptyState={
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HandHelping />
                  </EmptyMedia>
                  <EmptyTitle>No drop requests</EmptyTitle>
                  <EmptyDescription>
                    When staff drop shifts for others to pick up, they'll appear
                    here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </TabsContent>
      </Tabs>

      <Sheet
        open={!!reviewSwap}
        onOpenChange={(open) => !open && setReviewSwap(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {reviewSwap?.action === "approve" ? "Approve" : "Deny"} Swap
              Request
            </SheetTitle>
            <SheetDescription>
              Optionally add a note explaining your decision.
            </SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Manager note (optional)</Label>
              <Textarea
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                placeholder="Add a note for the staff members…"
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant={
                reviewSwap?.action === "deny" ? "destructive" : "default"
              }
              onClick={() =>
                reviewSwap &&
                swapMutation.mutate({
                  id: reviewSwap.id,
                  action: reviewSwap.action,
                  note: managerNote,
                })
              }
              disabled={swapMutation.isPending}
            >
              {reviewSwap?.action === "approve" ? "Approve swap" : "Deny swap"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === "drop-cancel") {
                  dropMutation.mutate({ id: confirm.id, action: "cancel" });
                } else {
                  swapMutation.mutate({
                    id: confirm.id,
                    action: confirm.action as
                      | "accept"
                      | "approve"
                      | "deny"
                      | "reject",
                  });
                }
                setConfirm(null);
              }}
            >
              Yes, confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 3-step swap creation sheet */}
      <Sheet
        open={swapStep > 0}
        onOpenChange={(open) => !open && setSwapStep(0)}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Request Shift Swap</SheetTitle>
            <SheetDescription>
              Step {swapStep} of 3 —{" "}
              {swapStep === 1
                ? "Select your shift"
                : swapStep === 2
                  ? "Choose a swap partner"
                  : "Confirm request"}
            </SheetDescription>
          </SheetHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-4 py-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    swapStep > s
                      ? "bg-primary text-primary-foreground"
                      : swapStep === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            {swapStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Which shift do you want to swap?
                </p>
                {myEligibleShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No upcoming published shifts to swap.
                  </p>
                ) : (
                  <RadioGroup
                    value={newSwapShiftId}
                    onValueChange={(v) => {
                      setNewSwapShiftId(v);
                      const s = myEligibleShifts.find((s) => s.id === v);
                      const a = s?.assignments.find(
                        (a) =>
                          a.staffId === user?.id && a.status === "assigned",
                      );
                      setNewSwapAssignmentId(a?.id ?? "");
                    }}
                  >
                    {myEligibleShifts.map((s) => (
                      <Label
                        key={s.id}
                        htmlFor={s.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          newSwapShiftId === s.id
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:bg-muted/20"
                        }`}
                      >
                        <RadioGroupItem id={s.id} value={s.id} />
                        <div>
                          <p className="text-sm font-medium">
                            {s.location.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(s.date + "T00:00:00"),
                              "EEE, MMM d",
                            )}{" "}
                            · {s.startTime}–{s.endTime}
                          </p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}

            {swapStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Who do you want to swap with?
                </p>
                <p className="text-xs text-muted-foreground">
                  Only active staff members are shown. The request will be sent
                  to them for acceptance.
                </p>
                {eligiblePartners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No eligible colleagues found.
                  </p>
                ) : (
                  <RadioGroup
                    value={newSwapPartnerId}
                    onValueChange={setNewSwapPartnerId}
                  >
                    {eligiblePartners.map((c) => (
                      <Label
                        key={c.id}
                        htmlFor={`p-${c.id}`}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          newSwapPartnerId === c.id
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:bg-muted/20"
                        }`}
                      >
                        <RadioGroupItem id={`p-${c.id}`} value={c.id} />
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {c.role}
                          </p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}

            {swapStep === 3 && selectedShift && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Swapping shift
                  </p>
                  <p className="text-sm font-medium">
                    {selectedShift.location.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(
                      new Date(selectedShift.date + "T00:00:00"),
                      "EEE, MMM d",
                    )}{" "}
                    · {selectedShift.startTime}–{selectedShift.endTime}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    With:{" "}
                    <span className="font-medium text-foreground">
                      {
                        eligiblePartners.find((p) => p.id === newSwapPartnerId)
                          ?.name
                      }
                    </span>
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Reason (optional)</Label>
                  <Textarea
                    value={newSwapReason}
                    onChange={(e) => setNewSwapReason(e.target.value)}
                    placeholder="Why do you want to swap this shift?"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="mt-4">
            {swapStep < 3 ? (
              <Button
                onClick={() => setSwapStep((s) => s + 1)}
                disabled={
                  (swapStep === 1 && !newSwapShiftId) ||
                  (swapStep === 2 && !newSwapPartnerId)
                }
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => createSwapMutation.mutate()}
                disabled={createSwapMutation.isPending || !newSwapAssignmentId}
              >
                {createSwapMutation.isPending ? "Sending…" : "Send request"}
              </Button>
            )}
            {swapStep > 1 ? (
              <Button
                variant="outline"
                onClick={() => setSwapStep((s) => s - 1)}
              >
                Back
              </Button>
            ) : (
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!reviewDrop}
        onOpenChange={(open) => !open && setReviewDrop(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {reviewDrop?.action === "approve" ? "Approve" : "Reject"} Drop
              Request
            </SheetTitle>
            <SheetDescription>
              Optionally add a note explaining your decision.
            </SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Manager note (optional)</Label>
              <Textarea
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                placeholder="Add a note for the staff member…"
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant={
                reviewDrop?.action === "reject" ? "destructive" : "default"
              }
              onClick={() =>
                reviewDrop &&
                dropMutation.mutate({
                  id: reviewDrop.id,
                  action: reviewDrop.action,
                  note: managerNote,
                })
              }
              disabled={dropMutation.isPending}
            >
              {reviewDrop?.action === "approve"
                ? "Approve drop"
                : "Reject drop"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
