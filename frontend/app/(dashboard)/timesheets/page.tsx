'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle,
  XCircle,
  Download,
  ClockIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { timesheetsApi, getErrorMessage } from '@/lib/api';
import { Timesheet, TimesheetStatus } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<TimesheetStatus, string> = {
  pending:  'bg-chart-warning/15 text-chart-warning border-chart-warning/30',
  approved: 'bg-chart-success/15 text-chart-success border-chart-success/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};

function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  return (
    <Badge className={`${STATUS_STYLES[status]} border capitalize text-xs`}>
      {status}
    </Badge>
  );
}

// ─── Clock-in/out widget ──────────────────────────────────────────────────────

function ClockWidget() {
  const queryClient = useQueryClient();
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState('0');

  const { data: openTimesheet, isLoading: openLoading } = useQuery<Timesheet | null>({
    queryKey: ['timesheet-open'],
    queryFn: timesheetsApi.getOpen,
    refetchInterval: 60_000,
  });

  const clockInMutation = useMutation({
    mutationFn: () => timesheetsApi.clockIn({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-open'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-mine'] });
      toast.success('Clocked in successfully');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => timesheetsApi.clockOut({ breakMinutes: parseInt(breakMinutes) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-open'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-mine'] });
      toast.success('Clocked out successfully');
      setClockOutOpen(false);
      setBreakMinutes('0');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (openLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <>
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${openTimesheet ? 'bg-chart-success/15' : 'bg-muted'}`}>
                <Clock className={`h-5 w-5 ${openTimesheet ? 'text-chart-success' : 'text-muted-foreground'}`} />
              </div>
              <div>
                {openTimesheet ? (
                  <>
                    <p className="text-sm font-semibold text-chart-success">Currently clocked in</p>
                    <p className="text-xs text-muted-foreground">
                      Since {format(parseISO(openTimesheet.clockIn), 'HH:mm')} on{' '}
                      {format(parseISO(openTimesheet.clockIn), 'MMM d')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Not clocked in</p>
                    <p className="text-xs text-muted-foreground">Clock in to start tracking your time</p>
                  </>
                )}
              </div>
            </div>

            {openTimesheet ? (
              <Button
                variant="outline"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setClockOutOpen(true)}
                disabled={clockOutMutation.isPending}
              >
                <LogOut className="h-4 w-4" />
                Clock Out
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
              >
                <LogIn className="h-4 w-4" />
                {clockInMutation.isPending ? 'Clocking in…' : 'Clock In'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clock-out dialog */}
      <Dialog open={clockOutOpen} onOpenChange={(open) => { setClockOutOpen(open); if (!open) setBreakMinutes('0'); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clock Out</DialogTitle>
            <DialogDescription>
              Enter your break time before clocking out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Break duration (minutes)</Label>
              <Input
                type="number"
                min="0"
                max="480"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                placeholder="0"
                className="w-32"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
            >
              {clockOutMutation.isPending ? 'Clocking out…' : 'Confirm Clock Out'}
            </Button>
            <Button variant="ghost" onClick={() => setClockOutOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── My timesheet history ─────────────────────────────────────────────────────

function MyTimesheets() {
  const { data: timesheets = [], isLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets-mine'],
    queryFn: timesheetsApi.getMine,
  });

  const myColumns: ColumnDef<Timesheet>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">
          {format(parseISO(row.original.clockIn), 'EEE, MMM d yyyy')}
        </span>
      ),
    },
    {
      id: 'clockIn',
      header: 'Clock In',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{format(parseISO(row.original.clockIn), 'HH:mm')}</span>
      ),
    },
    {
      id: 'clockOut',
      header: 'Clock Out',
      cell: ({ row }) =>
        row.original.clockOut ? (
          <span className="tabular-nums text-sm">{format(parseISO(row.original.clockOut), 'HH:mm')}</span>
        ) : (
          <span className="text-xs text-chart-success font-medium">Active</span>
        ),
    },
    {
      id: 'break',
      header: 'Break',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.original.breakMinutes}m
        </span>
      ),
    },
    {
      id: 'hours',
      header: 'Hours',
      cell: ({ row }) =>
        row.original.actualHours != null ? (
          <span className="tabular-nums text-sm font-medium">{row.original.actualHours.toFixed(2)}h</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <TimesheetStatusBadge status={row.original.status} />,
    },
  ];

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <DataTable
      columns={myColumns}
      data={timesheets}
      emptyState={
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClockIcon /></EmptyMedia>
            <EmptyTitle>No timesheet entries yet</EmptyTitle>
            <EmptyDescription>Your clock-in and clock-out history will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}

// ─── Manage timesheets (manager / admin) ──────────────────────────────────────

function ManageTimesheets() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Review dialog state
  const [reviewTarget, setReviewTarget] = useState<{
    id: string;
    action: 'approved' | 'rejected';
  } | null>(null);
  const [managerNote, setManagerNote] = useState('');

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  const filters = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { data: timesheets = [], isLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', filters],
    queryFn: () => timesheetsApi.list(filters),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'approved' | 'rejected'; note?: string }) =>
      timesheetsApi.review(id, { status, managerNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-mine'] });
      toast.success('Timesheet updated');
      setReviewTarget(null);
      setManagerNote('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleExport() {
    if (!exportStart || !exportEnd) {
      toast.error('Please select a date range');
      return;
    }
    const url = timesheetsApi.exportUrl({ startDate: exportStart, endDate: exportEnd });
    window.open(url, '_blank');
    setExportOpen(false);
  }

  // Client-side staff name search
  const filtered = search.trim()
    ? timesheets.filter((t) =>
        t.staff?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : timesheets;

  const columns: ColumnDef<Timesheet>[] = [
    {
      id: 'employee',
      header: 'Employee',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.staff?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">{format(parseISO(row.original.clockIn), 'EEE, MMM d yyyy')}</span>
      ),
    },
    {
      id: 'clockIn',
      header: 'Clock In',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{format(parseISO(row.original.clockIn), 'HH:mm')}</span>
      ),
    },
    {
      id: 'clockOut',
      header: 'Clock Out',
      cell: ({ row }) =>
        row.original.clockOut ? (
          <span className="tabular-nums text-sm">{format(parseISO(row.original.clockOut), 'HH:mm')}</span>
        ) : (
          <span className="text-xs text-chart-success font-medium">Active</span>
        ),
    },
    {
      id: 'hours',
      header: 'Hours',
      cell: ({ row }) =>
        row.original.actualHours != null ? (
          <span className="tabular-nums text-sm font-medium">{row.original.actualHours.toFixed(2)}h</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <TimesheetStatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const ts = row.original;
        if (ts.status !== 'pending') return null;
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-chart-success hover:bg-chart-success/10 hover:text-chart-success"
              onClick={() => { setManagerNote(''); setReviewTarget({ id: ts.id, action: 'approved' }); }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => { setManagerNote(''); setReviewTarget({ id: ts.id, action: 'rejected' }); }}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <DatePicker value={startDate || undefined} onChange={setStartDate} placeholder="Start date" className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <DatePicker value={endDate || undefined} onChange={setEndDate} placeholder="End date" className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Staff name</Label>
          <Input
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 h-9"
          />
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            Payroll Export
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyState={
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ClockIcon /></EmptyMedia>
                <EmptyTitle>No timesheets found</EmptyTitle>
                <EmptyDescription>No timesheet records match the current filters.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'approved' ? 'Approve' : 'Reject'} Timesheet
            </DialogTitle>
            <DialogDescription>
              Optionally add a note to explain your decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>Manager note (optional)</Label>
            <Textarea
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              placeholder="Add a note…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant={reviewTarget?.action === 'rejected' ? 'destructive' : 'default'}
              onClick={() =>
                reviewTarget &&
                reviewMutation.mutate({
                  id: reviewTarget.id,
                  status: reviewTarget.action,
                  note: managerNote,
                })
              }
              disabled={reviewMutation.isPending}
            >
              {reviewTarget?.action === 'approved' ? 'Approve' : 'Reject'}
            </Button>
            <Button variant="ghost" onClick={() => setReviewTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Payroll Export</DialogTitle>
            <DialogDescription>
              Select a date range to export approved timesheets as CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <DatePicker value={exportStart || undefined} onChange={setExportStart} placeholder="Start date" className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <DatePicker value={exportEnd || undefined} onChange={setExportEnd} placeholder="End date" className="w-full" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timesheets</h1>
        <p className="text-muted-foreground text-sm">Track hours worked and manage timesheet approvals</p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> My Timesheet
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="manage" className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Manage Timesheets
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine" className="space-y-4 mt-4">
          <ClockWidget />
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">History</h2>
            <MyTimesheets />
          </div>
        </TabsContent>

        {isManager && (
          <TabsContent value="manage" className="space-y-4 mt-4">
            <ManageTimesheets />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
