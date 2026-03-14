'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfWeek, addWeeks } from 'date-fns';
import { CalendarDays, MapPin, Clock, Star, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { shiftsApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Shift } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function tzAbbr(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

function getWeekDays(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function MySchedulePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const nextWeekStart = addWeeks(weekStart, 1);

  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(addWeeks(weekStart, 2), 'yyyy-MM-dd');

  const confirmMutation = useMutation({
    mutationFn: ({ shiftId, assignmentId }: { shiftId: string; assignmentId: string }) =>
      shiftsApi.confirmAssignment(shiftId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', 'my-schedule'] });
      toast.success('Shift confirmed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', 'my-schedule', startDate, endDate],
    queryFn: () => shiftsApi.list({ startDate, endDate }),
    enabled: !!user,
  });

  const myShifts = shifts.filter((s) =>
    s.assignments.some(
      (a) => a.staffId === user?.id && (a.status === 'assigned' || a.status === 'pending_swap'),
    ),
  );

  const thisWeekDays = getWeekDays(weekStart);
  const nextWeekDays = getWeekDays(nextWeekStart);

  const shiftsByDate = myShifts.reduce<Record<string, Shift[]>>((acc, shift) => {
    acc[shift.date] = [...(acc[shift.date] ?? []), shift];
    return acc;
  }, {});

  const totalHours = myShifts.reduce((acc, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return acc + (minutes > 0 ? minutes : minutes + 1440) / 60;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
        <p className="text-muted-foreground text-sm">
          {myShifts.length} shift{myShifts.length !== 1 ? 's' : ''} over the next 2 weeks · {totalHours.toFixed(1)} hours
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { label: 'This week', days: thisWeekDays },
            { label: 'Next week', days: nextWeekDays },
          ].map(({ label, days }) => {
            const weekShifts = days.flatMap((d) => shiftsByDate[d] ?? []);
            return (
              <div key={label}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{label}</h2>
                  {weekShifts.length > 0 && (
                    <span className="text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5">
                      {weekShifts.length} shift{weekShifts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((date, i) => {
                    const dayShifts = shiftsByDate[date] ?? [];
                    const isToday = date === format(today, 'yyyy-MM-dd');
                    const isPast = date < format(today, 'yyyy-MM-dd');

                    return (
                      <div key={date} className="space-y-1">
                        <div
                          className={cn(
                            'text-center rounded-lg py-1 text-xs font-medium',
                            isToday
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          <div>{DAYS[i]}</div>
                          <div className={cn('text-xs', isToday ? 'text-primary-foreground/80' : '')}>
                            {format(new Date(date + 'T00:00:00'), 'd')}
                          </div>
                        </div>
                        {dayShifts.map((shift) => {
                          const isPremium =
                            ['5', '6'].includes(String(new Date(shift.date + 'T00:00:00').getDay())) &&
                            shift.startTime >= '17:00';
                          const myAssignment = shift.assignments.find(
                            (a) => a.staffId === user?.id && a.status === 'assigned',
                          );
                          const isConfirmed = !!myAssignment?.confirmedAt;
                          return (
                            <div
                              key={shift.id}
                              className={cn(
                                'rounded-md border p-1.5 text-[0.625rem] leading-tight space-y-0.5',
                                isPast ? 'opacity-50' : '',
                                isPremium
                                  ? 'border-chart-warning/25 bg-chart-warning/8 text-chart-warning'
                                  : 'border-primary/20 bg-primary/8 text-primary',
                              )}
                            >
                              <div className="font-semibold tabular-nums">
                                {shift.startTime}–{shift.endTime}
                                {shift.location?.timezone && (
                                  <span className="ml-1 font-normal opacity-60">{tzAbbr(shift.location.timezone)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 text-[0.5625rem] opacity-80">
                                <MapPin className="h-2 w-2 shrink-0" />
                                <span className="truncate">{shift.location?.name}</span>
                              </div>
                              {isPremium && <Star className="h-2.5 w-2.5 fill-current" />}
                              {myAssignment && !isPast && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(
                                    'h-4 w-full rounded text-[0.5625rem] font-medium border mt-0.5',
                                    isConfirmed
                                      ? 'border-chart-success/30 bg-chart-success/10 text-chart-success cursor-default'
                                      : 'border-current/30 bg-background/40 hover:bg-background/60',
                                  )}
                                  onClick={() => {
                                    if (!isConfirmed) {
                                      confirmMutation.mutate({ shiftId: shift.id, assignmentId: myAssignment.id });
                                    }
                                  }}
                                  disabled={confirmMutation.isPending || isConfirmed}
                                >
                                  {isConfirmed ? <CheckCheck className="h-2.5 w-2.5" /> : '✓'}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                        {dayShifts.length === 0 && (
                          <div className="h-8 rounded-md border border-dashed border-border/30" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {myShifts.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
                <EmptyTitle>No shifts scheduled</EmptyTitle>
                <EmptyDescription>You have no upcoming shifts in the next 2 weeks. Contact your manager if you expect to be on the schedule.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}
