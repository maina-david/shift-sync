'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle, PlusCircle, Umbrella } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
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
import { timeOffApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { TimeOffRequest } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';


function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

function isValidISODate(s: string) {
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && s === d.toISOString().split('T')[0];
}

const requestSchema = z.object({
  startDate: z.string().min(1, 'Required').refine(isValidISODate, 'Invalid date'),
  endDate: z.string().min(1, 'Required').refine(isValidISODate, 'Invalid date'),
  reason: z.string().optional(),
}).refine((d) => d.startDate >= format(new Date(), 'yyyy-MM-dd'), {
  message: 'Start date cannot be in the past',
  path: ['startDate'],
}).refine((d) => d.endDate >= d.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

type RequestForm = z.infer<typeof requestSchema>;

export default function TimeOffPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<{ id: string; action: 'approve' | 'deny' } | null>(null);
  const [managerNote, setManagerNote] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: requests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ['time-off-requests'],
    queryFn: timeOffApi.list,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: RequestForm) => timeOffApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      toast.success('Time-off request submitted');
      setRequestOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'deny'; note: string }) =>
      action === 'approve' ? timeOffApi.approve(id, note) : timeOffApi.deny(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      toast.success('Done');
      setReviewItem(null);
      setManagerNote('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => timeOffApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      toast.success('Request cancelled');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const columns: ColumnDef<TimeOffRequest>[] = [
    ...(isManager ? [{
      id: 'staff',
      header: 'Staff',
      cell: ({ row }: { row: { original: TimeOffRequest } }) => (
        <span className="font-medium text-sm">{row.original.staff?.name ?? '—'}</span>
      ),
    }] : []),
    {
      id: 'dates',
      header: 'Dates',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">
            {format(new Date(row.original.startDate), 'MMM d')} – {format(new Date(row.original.endDate), 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground">
            {Math.ceil((new Date(row.original.endDate).getTime() - new Date(row.original.startDate).getTime()) / 86400000) + 1} day(s)
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.reason ?? '—'}</span>
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
      id: 'submitted',
      header: 'Submitted',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.createdAt), 'MMM d, HH:mm')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original;
        if (isManager && r.status === 'pending') {
          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Approve time-off request"
                className="h-7 w-7 text-chart-success hover:text-chart-success hover:bg-chart-success/10"
                onClick={() => { setManagerNote(''); setReviewItem({ id: r.id, action: 'approve' }); }}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Deny time-off request"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setManagerNote(''); setReviewItem({ id: r.id, action: 'deny' }); }}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        if (!isManager && r.status === 'pending' && r.staffId === user?.id) {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 text-xs"
              onClick={() => setCancelId(r.id)}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time-off Requests</h1>
          <p className="text-muted-foreground text-sm">
            {isManager
              ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`
              : 'Submit and track your time-off requests'}
          </p>
        </div>
        {!isManager && (
          <Button size="sm" onClick={() => setRequestOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Request time off
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={requests}
        emptyState={
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Umbrella /></EmptyMedia>
              <EmptyTitle>{isManager ? 'No time-off requests' : 'No requests yet'}</EmptyTitle>
              <EmptyDescription>
                {isManager
                  ? 'Staff time-off requests will appear here for your review.'
                  : 'Submit a request when you need time away from the schedule.'}
              </EmptyDescription>
            </EmptyHeader>
            {!isManager && (
              <EmptyContent>
                <Button size="sm" onClick={() => setRequestOpen(true)}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Request time off
                </Button>
              </EmptyContent>
            )}
          </Empty>
        }
      />

      <Sheet open={requestOpen} onOpenChange={setRequestOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request Time Off</SheetTitle>
            <SheetDescription>Select the dates you need off and optionally explain why.</SheetDescription>
          </SheetHeader>
          <form id="time-off-form" onSubmit={handleSubmit((d) => createMutation.mutate(d))} />
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Start date</Label>
              <DatePicker
                value={watch('startDate') || undefined}
                onChange={(v) => setValue('startDate', v, { shouldValidate: true })}
                placeholder="Pick start date"
                fromDate={new Date()}
              />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="grid gap-3">
              <Label>End date</Label>
              <DatePicker
                value={watch('endDate') || undefined}
                onChange={(v) => setValue('endDate', v, { shouldValidate: true })}
                placeholder="Pick end date"
                fromDate={new Date()}
              />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
            <div className="grid gap-3">
              <Label>Reason (optional)</Label>
              <Textarea {...register('reason')} placeholder="Vacation, personal, medical…" rows={3} />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" form="time-off-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel time-off request?</AlertDialogTitle>
            <AlertDialogDescription>This will withdraw your pending time-off request.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (cancelId) { cancelMutation.mutate(cancelId); setCancelId(null); } }}
            >
              Yes, cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!reviewItem} onOpenChange={(open) => !open && setReviewItem(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {reviewItem?.action === 'approve' ? 'Approve' : 'Deny'} Time-off Request
            </SheetTitle>
            <SheetDescription>Optionally add a note for the staff member.</SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Manager note (optional)</Label>
              <Textarea
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                placeholder="Add a note…"
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant={reviewItem?.action === 'deny' ? 'destructive' : 'default'}
              onClick={() =>
                reviewItem &&
                reviewMutation.mutate({ id: reviewItem.id, action: reviewItem.action, note: managerNote })
              }
              disabled={reviewMutation.isPending}
            >
              {reviewItem?.action === 'approve' ? 'Approve' : 'Deny'}
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
