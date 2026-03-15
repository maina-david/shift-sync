'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { format, startOfWeek, addWeeks } from 'date-fns';
import Link from 'next/link';
import {
  Users, CalendarDays, ArrowLeftRight, AlertCircle, Clock, TrendingUp,
  HandHelping, Umbrella, CalendarRange, ChevronRight, CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { shiftsApi, swapRequestsApi, dropRequestsApi, analyticsApi, timeOffApi, getErrorMessage } from '@/lib/api';
import { SetupChecklist } from '@/components/ui/setup-checklist';
import { getSocket } from '@/lib/socket';
import { Shift, SwapRequest, DropRequest, OvertimeEntry, TimeOffRequest } from '@/lib/types';
import { cn, parseTimeMinutes } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = user?.role === 'staff';

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const nextWeekStart = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');
  const twoWeeksEnd = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 2), 'yyyy-MM-dd');

  useEffect(() => {
    if (user?.role === 'staff') return;
    const socket = getSocket();
    const handler = () => {
      // Compute today fresh inside the handler so it's never stale past midnight.
      const currentDay = format(new Date(), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['on-duty-now', currentDay] });
    };
    socket.on('schedule:updated', handler);
    return () => { socket.off('schedule:updated', handler); };
  }, [user?.role, queryClient]);

  const { data: todayShifts = [], isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', 'today'],
    queryFn: () => shiftsApi.list({ startDate: today, endDate: today }),
  });

  const { data: upcomingShifts = [], isLoading: upcomingLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', 'upcoming', weekStart, twoWeeksEnd],
    queryFn: () => shiftsApi.list({ startDate: today, endDate: twoWeeksEnd }),
    enabled: !!user && isStaff,
  });

  const { data: onDuty = [], isLoading: onDutyLoading } = useQuery({
    queryKey: ['on-duty-now', today],
    queryFn: () => shiftsApi.onDutyNow(),
    refetchInterval: 60_000,
    enabled: !!user && !isStaff,
  });

  const { data: availableShifts = [] } = useQuery<Shift[]>({
    queryKey: ['shifts-available'],
    queryFn: () => shiftsApi.availableForPickup(),
    enabled: !!user && isStaff,
  });

  const { data: swaps = [] } = useQuery<SwapRequest[]>({
    queryKey: ['swap-requests'],
    queryFn: swapRequestsApi.list,
  });

  const { data: drops = [] } = useQuery<DropRequest[]>({
    queryKey: ['drop-requests'],
    queryFn: dropRequestsApi.list,
  });

  const { data: timeOffRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ['time-off-requests'],
    queryFn: timeOffApi.list,
    enabled: !!user && !isStaff,
  });

  const { data: overtime = [] } = useQuery({
    queryKey: ['analytics', 'overtime', weekStart],
    queryFn: () => analyticsApi.overtime(weekStart),
    enabled: !!user && !isStaff,
  });

  const myUpcoming = (upcomingShifts as Shift[]).filter((s) =>
    s.assignments.some((a) => a.staffId === user?.id && (a.status === 'assigned' || a.status === 'pending_swap')),
  ).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const myWeekShifts = myUpcoming.filter((s) => s.date >= weekStart && s.date < nextWeekStart);
  const myWeekHours = myWeekShifts.reduce((acc, s) => {
    const start = parseTimeMinutes(s.startTime);
    const end = parseTimeMinutes(s.endTime);
    if (start === null || end === null) return acc;
    const mins = end - start;
    return acc + (mins > 0 ? mins : mins + 1440) / 60;
  }, 0);

  const myPendingSwaps = swaps.filter(
    (s) => ['pending', 'accepted'].includes(s.status) &&
    (s.fromAssignment?.staffId === user?.id || s.toUserId === user?.id),
  ).length;
  const myOpenDrops = drops.filter(
    (d) => d.status === 'open' && d.assignment?.staffId === user?.id,
  ).length;
  const myPendingTotal = myPendingSwaps + myOpenDrops;

  const pendingApprovals = [
    ...timeOffRequests.filter((r) => r.status === 'pending'),
    ...swaps.filter((s) => s.status === 'accepted'),
    ...drops.filter((d) => d.status === 'claimed'),
  ].length;

  const overtimeAtRisk = Array.isArray(overtime)
    ? (overtime as OvertimeEntry[]).filter((o) => o.isAtRisk)
    : [];

  const onDutyCount = (onDuty as Shift[]).reduce(
    (acc: number, s: Shift) => acc + s.assignments.length,
    0,
  );

  const unfilled = todayShifts.filter(
    (s) => s.assignments.filter((a) => a.status === 'assigned').length < s.headcount,
  ).length;

  const todayShift = isStaff ? myUpcoming.find((s) => s.date === today) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Today-first card — mobile only, staff only */}
      {isStaff && (
        <div className="md:hidden">
          {(shiftsLoading || upcomingLoading) ? (
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-2">
              <div className="h-3 w-28 bg-muted animate-pulse rounded" />
              <div className="h-14 w-full bg-muted animate-pulse rounded-lg" />
            </div>
          ) : todayShift ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-primary/70 mb-2">Today's Shift</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{todayShift.location?.name ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">
                    {todayShift.startTime}–{todayShift.endTime}
                    {todayShift.requiredSkill && ` · ${todayShift.requiredSkill.name}`}
                  </p>
                </div>
                <div className="shrink-0 text-center bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <p className="text-[0.625rem] text-primary/70 font-medium">Today</p>
                  <p className="text-xl font-bold text-primary">{format(new Date(), 'd')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-4 text-center">
              <p className="text-sm font-medium text-muted-foreground">No shift today</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Enjoy your day off</p>
            </div>
          )}
        </div>
      )}

      {/* Setup checklist — admin only, collapses once all steps done */}
      {user?.role === 'admin' && <SetupChecklist />}

      {isStaff ? (
        <StaffDashboard
          myUpcoming={myUpcoming}
          myWeekHours={myWeekHours}
          desiredHours={user?.desiredHoursPerWeek ?? 40}
          myPendingTotal={myPendingTotal}
          availableCount={(availableShifts as Shift[]).length}
          upcomingLoading={upcomingLoading}
        />
      ) : (
        <ManagerDashboard
          todayShifts={todayShifts}
          shiftsLoading={shiftsLoading}
          onDuty={onDuty as Shift[]}
          onDutyLoading={onDutyLoading}
          onDutyCount={onDutyCount}
          pendingApprovals={pendingApprovals}
          overtimeAtRisk={overtimeAtRisk}
          unfilled={unfilled}
        />
      )}
    </div>
  );
}

function StaffDashboard({
  myUpcoming,
  myWeekHours,
  desiredHours,
  myPendingTotal,
  availableCount,
  upcomingLoading,
}: {
  myUpcoming: Shift[];
  myWeekHours: number;
  desiredHours: number;
  myPendingTotal: number;
  availableCount: number;
  upcomingLoading: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const myThisWeek = myUpcoming.filter((s) => {
    const d = new Date(s.date + 'T00:00:00Z');
    const today = new Date();
    const weekEnd = new Date(startOfWeek(today, { weekStartsOn: 1 }));
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= startOfWeek(today, { weekStartsOn: 1 }) && d < weekEnd;
  });

  const confirmMutation = useMutation({
    mutationFn: ({ shiftId, assignmentId }: { shiftId: string; assignmentId: string }) =>
      shiftsApi.confirmAssignment(shiftId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', 'upcoming'] });
      toast.success('Shift confirmed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const hoursProgress = Math.min((myWeekHours / (desiredHours || 40)) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="My Shifts This Week"
          value={myThisWeek.length}
          icon={CalendarDays}
          description="scheduled this week"
          accent="primary"
          isLoading={upcomingLoading}
        />
        <div className={cn('relative rounded-xl border p-5 overflow-hidden bg-chart-success/8 border-chart-success/15')}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Hours Scheduled</p>
            <div className="p-1.5 rounded-md bg-chart-success/10">
              <Clock className="h-3.5 w-3.5 text-chart-success" />
            </div>
          </div>
          {upcomingLoading ? (
            <Skeleton className="h-9 w-20 mb-2" />
          ) : (
            <p className="text-3xl font-bold tabular-nums tracking-tight text-chart-success">
              {myWeekHours.toFixed(1)}
              <span className="text-base font-normal text-muted-foreground ml-1">/ {desiredHours}h</span>
            </p>
          )}
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-chart-success transition-all duration-500"
              style={{ width: `${hoursProgress}%` }}
            />
          </div>
        </div>
        <StatCard
          title="Pending Requests"
          value={myPendingTotal}
          icon={ArrowLeftRight}
          description="swaps & drops open"
          accent={myPendingTotal >= 3 ? 'danger' : myPendingTotal > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Open Shifts"
          value={availableCount}
          icon={HandHelping}
          description="available to claim"
          accent={availableCount > 0 ? 'success' : 'default'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="My Upcoming Shifts" subtitle="Next shifts across all locations">
          {upcomingLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : myUpcoming.length === 0 ? (
            <Empty text="No upcoming shifts" />
          ) : (
            <div className="space-y-2">
              {myUpcoming.slice(0, 5).map((shift) => {
                const myAssignment = shift.assignments.find(
                  (a) => a.staffId === user?.id && a.status === 'assigned',
                );
                const isConfirmed = !!myAssignment?.confirmedAt;
                const isPast = shift.date < format(new Date(), 'yyyy-MM-dd');
                const isToday = shift.date === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'shrink-0 w-10 text-center rounded-md py-1 text-xs font-medium',
                        isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground',
                      )}>
                        <div>{format(new Date(shift.date + 'T00:00:00'), 'EEE')}</div>
                        <div className="text-xs font-bold">{format(new Date(shift.date + 'T00:00:00'), 'd')}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{shift.location?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {shift.startTime}–{shift.endTime}
                          {shift.requiredSkill && ` · ${shift.requiredSkill.name}`}
                        </p>
                      </div>
                    </div>
                    {myAssignment && !isPast && (
                      <Button
                        size="sm"
                        variant={isConfirmed ? 'ghost' : 'outline'}
                        className={cn(
                          'h-7 text-xs shrink-0',
                          isConfirmed
                            ? 'text-chart-success border-chart-success/30 bg-chart-success/8 cursor-default'
                            : '',
                        )}
                        onClick={() => {
                          if (!isConfirmed) {
                            confirmMutation.mutate({ shiftId: shift.id, assignmentId: myAssignment.id });
                          }
                        }}
                        disabled={confirmMutation.isPending || isConfirmed}
                      >
                        {isConfirmed ? (
                          <><CheckCheck className="h-3 w-3 mr-1" />Confirmed</>
                        ) : 'Confirm'}
                      </Button>
                    )}
                  </div>
                );
              })}
              {myUpcoming.length > 5 && (
                <Link href="/my-schedule" className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View all {myUpcoming.length} shifts <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Quick Actions" subtitle="Jump to common tasks">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                href: '/my-schedule',
                icon: CalendarRange,
                label: 'My Schedule',
                description: 'View your full schedule',
                accent: 'text-primary bg-primary/10 border-primary/20',
              },
              {
                href: '/pickup',
                icon: HandHelping,
                label: 'Open Shifts',
                description: 'Pick up available shifts',
                accent: 'text-chart-success bg-chart-success/10 border-chart-success/20',
              },
              {
                href: '/time-off',
                icon: Umbrella,
                label: 'Time Off',
                description: 'Request time away',
                accent: 'text-chart-2 bg-chart-2/10 border-chart-2/20',
              },
              {
                href: '/swap-requests',
                icon: ArrowLeftRight,
                label: 'Swap & Drop',
                description: 'Manage shift swaps',
                accent: 'text-chart-warning bg-chart-warning/10 border-chart-warning/20',
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col gap-2 rounded-lg border border-border/50 bg-card/40 p-3 hover:bg-muted/20 hover:border-border transition-all duration-150"
              >
                <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', action.accent)}>
                  <action.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ManagerDashboard({
  todayShifts,
  shiftsLoading,
  onDuty,
  onDutyLoading,
  onDutyCount,
  pendingApprovals,
  overtimeAtRisk,
  unfilled,
}: {
  todayShifts: Shift[];
  shiftsLoading: boolean;
  onDuty: Shift[];
  onDutyLoading: boolean;
  onDutyCount: number;
  pendingApprovals: number;
  overtimeAtRisk: OvertimeEntry[];
  unfilled: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="On Duty Now"
          value={onDutyCount}
          icon={Users}
          description="currently working"
          isLoading={onDutyLoading}
          accent="success"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovals}
          icon={Clock}
          description="time-off, swaps & drops"
          accent={pendingApprovals > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Overtime Risk"
          value={overtimeAtRisk.length}
          icon={AlertCircle}
          description="approaching 40h this week"
          accent={overtimeAtRisk.length > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="Unfilled Shifts"
          value={unfilled}
          icon={CalendarDays}
          description="open slots today"
          isLoading={shiftsLoading}
          accent={unfilled > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today's Schedule" subtitle={format(new Date(), 'EEEE, MMMM d')}>
          {shiftsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : todayShifts.length === 0 ? (
            <Empty text="No shifts scheduled today" />
          ) : (
            <div className="space-y-2">
              {todayShifts.slice(0, 6).map((shift) => {
                const assigned = shift.assignments.filter((a) => a.status === 'assigned').length;
                const isFull = assigned >= shift.headcount;
                return (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{shift.location?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {shift.startTime}–{shift.endTime}
                        {shift.requiredSkill && ` · ${shift.requiredSkill.name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={cn(
                        'text-xs font-medium tabular-nums',
                        isFull ? 'text-chart-success' : 'text-chart-warning',
                      )}>
                        {assigned}/{shift.headcount}
                      </span>
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        isFull ? 'bg-chart-success' : 'bg-chart-warning',
                      )} />
                    </div>
                  </div>
                );
              })}
              {todayShifts.length > 6 && (
                <Link href="/schedule" className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View all {todayShifts.length} shifts <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </Panel>

        <Panel title="On Duty Now" subtitle="Updates live" badge={<LiveBadge />}>
          {onDutyLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : onDuty.length === 0 ? (
            <Empty text="No active shifts right now" />
          ) : (
            <div className="space-y-2">
              {onDuty.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-lg border border-chart-success/15 bg-chart-success/5 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium">{shift.location?.name ?? '—'}</p>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {shift.startTime}–{shift.endTime}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {shift.assignments.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center rounded-full border border-border/50 bg-background/50 px-2 py-0.5 text-xs font-medium"
                      >
                        {a.staff.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {overtimeAtRisk.length > 0 && (
        <Panel title="Overtime Detail" subtitle="Staff approaching or exceeding 40h this week">
          <div className="space-y-3">
            {overtimeAtRisk.map((entry) => {
              const pushers = entry.assignments.filter((a) => a.isOvertimePusher || a.isInOvertime);
              if (pushers.length === 0) return null;
              return (
                <div key={entry.staffId} className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <div className="flex items-center gap-2">
                      {entry.overtimeCost !== null && entry.overtimeCost > 0 && (
                        <span className="text-xs text-muted-foreground">${entry.overtimeCost.toFixed(2)} OT cost</span>
                      )}
                      <span className={cn(
                        'text-xs font-semibold tabular-nums',
                        entry.isOvertime ? 'text-destructive' : 'text-chart-warning',
                      )}>
                        {entry.weeklyHours}h / 40h
                      </span>
                    </div>
                  </div>
                  <div className="mb-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', entry.isOvertime ? 'bg-destructive' : 'bg-chart-warning')}
                      style={{ width: `${Math.min((entry.weeklyHours / 40) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pushers.map((a, i) => (
                      <span
                        key={i}
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                          a.isInOvertime
                            ? 'border-destructive/25 bg-destructive/10 text-destructive'
                            : 'border-chart-warning/25 bg-chart-warning/10 text-chart-warning',
                        )}
                      >
                        {format(new Date(a.date + 'T00:00:00'), 'EEE d')} {a.startTime}–{a.endTime}
                        {a.isOvertimePusher && ' ⚡'}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

type Accent = 'primary' | 'success' | 'warning' | 'danger' | 'default';

const ACCENT_MAP: Record<Accent, { icon: string; bg: string; border: string; value: string; iconBg: string }> = {
  primary: { icon: 'text-chart-1', bg: 'bg-chart-1/8', border: 'border-chart-1/15', value: 'text-chart-1', iconBg: 'bg-chart-1/10' },
  success: { icon: 'text-chart-success', bg: 'bg-chart-success/8', border: 'border-chart-success/15', value: 'text-chart-success', iconBg: 'bg-chart-success/10' },
  warning: { icon: 'text-chart-warning', bg: 'bg-chart-warning/8', border: 'border-chart-warning/15', value: 'text-chart-warning', iconBg: 'bg-chart-warning/10' },
  danger: { icon: 'text-destructive', bg: 'bg-destructive/8', border: 'border-destructive/15', value: 'text-destructive', iconBg: 'bg-destructive/10' },
  default: { icon: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border/50', value: 'text-foreground', iconBg: 'bg-muted/40' },
};

function StatCard({
  title, value, icon: Icon, description, isLoading = false, accent = 'default',
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  isLoading?: boolean;
  accent?: Accent;
}) {
  const a = ACCENT_MAP[accent];
  return (
    <div className={cn('relative rounded-xl border p-5 overflow-hidden', a.bg, a.border)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className={cn('p-1.5 rounded-md', a.iconBg)}>
          <Icon className={cn('h-3.5 w-3.5', a.icon)} />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-9 w-14 mb-1" />
      ) : (
        <p className={cn('text-3xl font-bold tabular-nums tracking-tight', a.value)}>{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function Panel({
  title, subtitle, badge, children,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {badge}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-chart-success/20 bg-chart-success/8 px-2 py-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-success opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-chart-success" />
      </span>
      <span className="text-xs font-medium text-chart-success">Live</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <TrendingUp className="h-5 w-5 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
