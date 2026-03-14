'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle, MoreHorizontal, AlertTriangle, ArrowLeftRight, HandHelping } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { swapRequestsApi, dropRequestsApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { SwapRequest, DropRequest } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';


export default function SwapRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewSwap, setReviewSwap] = useState<{ id: string; action: 'approve' | 'deny' } | null>(null);
  const [reviewDrop, setReviewDrop] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [managerNote, setManagerNote] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; action: string; label: string } | null>(null);

  const { data: swaps = [] } = useQuery<SwapRequest[]>({
    queryKey: ['swap-requests'],
    queryFn: swapRequestsApi.list,
  });

  const { data: drops = [] } = useQuery<DropRequest[]>({
    queryKey: ['drop-requests'],
    queryFn: dropRequestsApi.list,
  });

  const swapMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'deny' | 'accept' | 'reject'; note?: string }) =>
      action === 'approve'
        ? swapRequestsApi.approve(id, note)
        : action === 'deny'
        ? swapRequestsApi.deny(id, note)
        : action === 'accept'
        ? swapRequestsApi.accept(id)
        : swapRequestsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      toast.success('Done');
      setReviewSwap(null);
      setManagerNote('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const dropMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'claim' | 'approve' | 'cancel' | 'reject'; note?: string }) =>
      action === 'claim'
        ? dropRequestsApi.claim(id)
        : action === 'approve'
        ? dropRequestsApi.approve(id, note)
        : action === 'cancel'
        ? dropRequestsApi.cancel(id)
        : dropRequestsApi.reject(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drop-requests'] });
      toast.success('Done');
      setReviewDrop(null);
      setManagerNote('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const myPendingSwaps = swaps.filter(
    (s) => s.status === 'pending' && s.fromAssignment?.staffId === user?.id,
  ).length;
  const myOpenDrops = drops.filter(
    (d) => d.status === 'open' && d.assignment?.staffId === user?.id,
  ).length;
  const myPendingTotal = myPendingSwaps + myOpenDrops;

  const swapColumns: ColumnDef<SwapRequest>[] = [
    {
      id: 'shift',
      header: 'Shift',
      cell: ({ row }) => {
        const s = row.original.fromAssignment?.shift;
        return s ? (
          <div>
            <p className="font-medium text-sm">{s.location?.name}</p>
            <p className="text-xs text-muted-foreground">{s.date} · {s.startTime}–{s.endTime}</p>
          </div>
        ) : '—';
      },
    },
    {
      id: 'from',
      header: 'From',
      cell: ({ row }) => row.original.fromAssignment?.staff?.name ?? '—',
    },
    {
      id: 'to',
      header: 'To',
      cell: ({ row }) => row.original.toUser?.name ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const swap = row.original;
        const canManagerAct = isManager && swap.status === 'accepted';
        const canTargetAct = !isManager && swap.status === 'pending' && swap.toUserId === user?.id;
        const canRequesterCancel = !isManager && ['pending', 'accepted'].includes(swap.status) && swap.fromAssignment?.staffId === user?.id;

        if (!canManagerAct && !canTargetAct && !canRequesterCancel) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Request actions" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManagerAct && (
                <>
                  <DropdownMenuItem
                    className="text-chart-success focus:text-chart-success"
                    onClick={() => { setManagerNote(''); setReviewSwap({ id: swap.id, action: 'approve' }); }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setManagerNote(''); setReviewSwap({ id: swap.id, action: 'deny' }); }}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Deny
                  </DropdownMenuItem>
                </>
              )}
              {canTargetAct && (
                <>
                  <DropdownMenuItem
                    className="text-chart-success focus:text-chart-success"
                    onClick={() => swapMutation.mutate({ id: swap.id, action: 'accept' })}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Accept
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirm({ id: swap.id, action: 'reject', label: 'Reject this swap request?' })}
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
                    onClick={() => setConfirm({ id: swap.id, action: 'cancel', label: 'Cancel this swap request?' })}
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
      id: 'shift',
      header: 'Shift',
      cell: ({ row }) => {
        const s = row.original.assignment?.shift;
        return s ? (
          <div>
            <p className="font-medium text-sm">{s.location?.name}</p>
            <p className="text-xs text-muted-foreground">{s.date} · {s.startTime}–{s.endTime}</p>
          </div>
        ) : '—';
      },
    },
    {
      id: 'original',
      header: 'Original staff',
      cell: ({ row }) => row.original.assignment?.staff?.name ?? '—',
    },
    {
      id: 'claimedBy',
      header: 'Claimed by',
      cell: ({ row }) => row.original.claimedBy?.name ?? '—',
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.expiresAt), 'MMM d HH:mm')}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const drop = row.original;
        const canManagerAct = isManager && drop.status === 'claimed';
        const canClaim = !isManager && drop.status === 'open' && drop.assignment?.staffId !== user?.id;
        const canCancel = !isManager && drop.status === 'open' && drop.assignment?.staffId === user?.id;

        if (!canManagerAct && !canClaim && !canCancel) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Request actions" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManagerAct && (
                <>
                  <DropdownMenuItem
                    className="text-chart-success focus:text-chart-success"
                    onClick={() => { setManagerNote(''); setReviewDrop({ id: drop.id, action: 'approve' }); }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setManagerNote(''); setReviewDrop({ id: drop.id, action: 'reject' }); }}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </DropdownMenuItem>
                </>
              )}
              {canClaim && (
                <DropdownMenuItem
                  className="text-primary focus:text-primary"
                  onClick={() => dropMutation.mutate({ id: drop.id, action: 'claim' })}
                >
                  Claim shift
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem
                  className="text-muted-foreground focus:text-foreground"
                  onClick={() => setConfirm({ id: drop.id, action: 'drop-cancel', label: 'Cancel this drop request?' })}
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Swap & Drop Requests</h1>
        <p className="text-muted-foreground text-sm">Manage shift swap and drop requests</p>
      </div>

      {!isManager && myPendingTotal >= 3 && (
        <div className="flex items-start gap-3 rounded-lg border border-chart-warning/30 bg-chart-warning/8 px-4 py-3 text-sm text-chart-warning">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            You have {myPendingTotal} pending request{myPendingTotal > 1 ? 's' : ''} — you've reached the maximum of 3. Cancel an existing request before creating a new one.
          </span>
        </div>
      )}

      <Tabs defaultValue="swaps">
        <TabsList>
          <TabsTrigger value="swaps">
            Swaps
            {swaps.filter((s) => ['pending', 'accepted'].includes(s.status)).length > 0 && (
              <Badge className="ml-2 bg-chart-warning/20 text-chart-warning border-chart-warning/30 border text-xs px-1.5 py-0">
                {swaps.filter((s) => ['pending', 'accepted'].includes(s.status)).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="drops">
            Drops
            {drops.filter((d) => ['open', 'claimed'].includes(d.status)).length > 0 && (
              <Badge className="ml-2 bg-chart-warning/20 text-chart-warning border-chart-warning/30 border text-xs px-1.5 py-0">
                {drops.filter((d) => ['open', 'claimed'].includes(d.status)).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swaps" className="mt-4">
          <DataTable
            columns={swapColumns}
            data={swaps}
            emptyState={
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ArrowLeftRight /></EmptyMedia>
                  <EmptyTitle>No swap requests</EmptyTitle>
                  <EmptyDescription>Shift swap requests between team members will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </TabsContent>
        <TabsContent value="drops" className="mt-4">
          <DataTable
            columns={dropColumns}
            data={drops}
            emptyState={
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><HandHelping /></EmptyMedia>
                  <EmptyTitle>No drop requests</EmptyTitle>
                  <EmptyDescription>When staff drop shifts for others to pick up, they'll appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </TabsContent>
      </Tabs>

      <Sheet open={!!reviewSwap} onOpenChange={(open) => !open && setReviewSwap(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {reviewSwap?.action === 'approve' ? 'Approve' : 'Deny'} Swap Request
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
              variant={reviewSwap?.action === 'deny' ? 'destructive' : 'default'}
              onClick={() =>
                reviewSwap &&
                swapMutation.mutate({ id: reviewSwap.id, action: reviewSwap.action, note: managerNote })
              }
              disabled={swapMutation.isPending}
            >
              {reviewSwap?.action === 'approve' ? 'Approve swap' : 'Deny swap'}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label}</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === 'drop-cancel') {
                  dropMutation.mutate({ id: confirm.id, action: 'cancel' });
                } else {
                  swapMutation.mutate({ id: confirm.id, action: confirm.action });
                }
                setConfirm(null);
              }}
            >
              Yes, confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!reviewDrop} onOpenChange={(open) => !open && setReviewDrop(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {reviewDrop?.action === 'approve' ? 'Approve' : 'Reject'} Drop Request
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
              variant={reviewDrop?.action === 'reject' ? 'destructive' : 'default'}
              onClick={() =>
                reviewDrop &&
                dropMutation.mutate({ id: reviewDrop.id, action: reviewDrop.action, note: managerNote })
              }
              disabled={dropMutation.isPending}
            >
              {reviewDrop?.action === 'approve' ? 'Approve drop' : 'Reject drop'}
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
