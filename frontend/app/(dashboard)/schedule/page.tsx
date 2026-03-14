'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Send, Copy, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ShiftCard } from '@/components/schedule/shift-card';
import { Empty, EmptyMedia, EmptyDescription } from '@/components/ui/empty';
import { shiftsApi, locationsApi, skillsApi, getErrorMessage } from '@/lib/api';
import { Shift, Location, Skill } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SchedulePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    requiredSkillId: 'none',
    headcount: '1',
    notes: '',
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
    enabled: createOpen,
  });

  const firstLocationId = selectedLocationId || locations[0]?.id || '';

  const { data: shifts = [], isLoading, isError: shiftsError } = useQuery<Shift[]>({
    queryKey: ['shifts', firstLocationId, format(weekStart, 'yyyy-MM-dd')],
    queryFn: () =>
      shiftsApi.list({
        locationId: firstLocationId || undefined,
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
      }),
    enabled: !!firstLocationId || user?.role === 'staff',
  });

  useEffect(() => {
    const socket = getSocket();
    socket.on('schedule:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    });
    return () => { socket.off('schedule:updated'); };
  }, [queryClient]);

  const publishWeekMutation = useMutation({
    mutationFn: () => shiftsApi.publishWeek(firstLocationId, format(weekStart, 'yyyy-MM-dd')),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(`Published ${res.published} shifts`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const copyWeekMutation = useMutation({
    mutationFn: () =>
      shiftsApi.copyWeek(
        format(weekStart, 'yyyy-MM-dd'),
        format(addWeeks(weekStart, 1), 'yyyy-MM-dd'),
        firstLocationId,
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(`Copied ${res.copied} shifts to next week`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      shiftsApi.create({
        locationId: firstLocationId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        requiredSkillId: form.requiredSkillId === 'none' ? undefined : form.requiredSkillId,
        headcount: parseInt(form.headcount, 10),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift created');
      setCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const getShiftsForDay = (date: Date) =>
    shifts.filter((s) => s.date === format(date, 'yyyy-MM-dd'));

  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const draftCount = shifts.filter((s) => s.status === 'draft').length;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground text-sm">
            Week of {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isManager && locations.length > 0 && (
            <Select value={firstLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isManager && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyWeekMutation.mutate()}
                disabled={copyWeekMutation.isPending || !firstLocationId || shifts.length === 0}
                title="Copy this week's shifts to next week as drafts"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy to next week
              </Button>
              {draftCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => publishWeekMutation.mutate()}
                  disabled={publishWeekMutation.isPending || !firstLocationId}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Publish week ({draftCount})
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  setForm({
                    date: format(weekStart, 'yyyy-MM-dd'),
                    startTime: '09:00',
                    endTime: '17:00',
                    requiredSkillId: 'none',
                    headcount: '1',
                    notes: '',
                  });
                  setCreateOpen(true);
                }}
                disabled={!firstLocationId}
              >
                <Plus className="h-4 w-4 mr-2" />
                New shift
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="grid grid-cols-7 gap-2 min-w-160">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center">
            <p className={cn('text-sm font-medium', format(day, 'yyyy-MM-dd') === todayStr && 'text-primary')}>
              {DAYS[i]}
            </p>
            <p className={cn('text-xs text-muted-foreground', format(day, 'yyyy-MM-dd') === todayStr && 'text-primary font-semibold')}>
              {format(day, 'MMM d')}
            </p>
          </div>
        ))}

        {weekDays.map((day, i) => {
          const dayShifts = getShiftsForDay(day);
          return (
            <div
              key={i}
              className={cn(
                'min-h-32 space-y-1.5 p-1 rounded-lg',
                format(day, 'yyyy-MM-dd') === todayStr && 'bg-primary/5 ring-1 ring-primary/20',
              )}
            >
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full opacity-50" />
                </div>
              ) : shiftsError ? (
                <p className="text-[0.625rem] text-destructive/60 text-center pt-4">Failed to load</p>
              ) : dayShifts.length === 0 ? (
                <Empty className="min-h-28 p-2 gap-1 border border-dashed border-border/30">
                  <EmptyMedia variant="icon" className="mb-0 size-7 [&_svg:not([class*='size-'])]:size-3.5">
                    <CalendarDays className="text-muted-foreground/40" />
                  </EmptyMedia>
                  <EmptyDescription className="text-[0.625rem] text-muted-foreground/40">
                    No shifts
                  </EmptyDescription>
                </Empty>
              ) : (
                dayShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)
              )}
            </div>
          );
        })}
      </div>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Shift</SheetTitle>
            <SheetDescription>Add a new shift to the schedule for this location.</SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Date</Label>
              <DatePicker
                value={form.date || undefined}
                onChange={(v) => setForm({ ...form, date: v })}
                placeholder="Pick date"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-3">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="grid gap-3">
                <Label>End time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Required skill (optional)</Label>
              <Select
                value={form.requiredSkillId}
                onValueChange={(v) => setForm({ ...form, requiredSkillId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any skill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any skill</SelectItem>
                  {skills.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <Label>Headcount</Label>
              <Input
                type="number"
                min="1"
                className="w-24"
                value={form.headcount}
                onChange={(e) => setForm({ ...form, headcount: e.target.value })}
              />
            </div>

            <div className="grid gap-3">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes for this shift…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.date || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create shift'}
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
