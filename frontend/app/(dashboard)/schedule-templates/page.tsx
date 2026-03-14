'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO, getDay } from 'date-fns';
import {
  LayoutTemplate,
  Plus,
  Trash2,
  CalendarCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { scheduleTemplatesApi, skillsApi, locationsApi, getErrorMessage } from '@/lib/api';
import { Location, ScheduleTemplate, Skill, TemplateShift } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

const DAY_LABELS: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

// ─── Empty shift row ──────────────────────────────────────────────────────────

type ShiftDraft = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  requiredSkillId: string;
  headcount: string;
};

function emptyShiftRow(): ShiftDraft {
  return { dayOfWeek: '1', startTime: '09:00', endTime: '17:00', requiredSkillId: '', headcount: '1' };
}

// ─── Shift row editor ─────────────────────────────────────────────────────────

function ShiftRowEditor({
  shift,
  index,
  skills,
  onChange,
  onRemove,
}: {
  shift: ShiftDraft;
  index: number;
  skills: Skill[];
  onChange: (index: number, field: keyof ShiftDraft, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-2 items-center">
      {/* Day of week */}
      <Select
        value={shift.dayOfWeek}
        onValueChange={(v) => onChange(index, 'dayOfWeek', v)}
      >
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAYS_OF_WEEK.map((d) => (
            <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Start time */}
      <Input
        type="time"
        value={shift.startTime}
        onChange={(e) => onChange(index, 'startTime', e.target.value)}
        className="h-8 text-xs"
      />

      {/* End time */}
      <Input
        type="time"
        value={shift.endTime}
        onChange={(e) => onChange(index, 'endTime', e.target.value)}
        className="h-8 text-xs"
      />

      {/* Required skill */}
      <Select
        value={shift.requiredSkillId || '__none__'}
        onValueChange={(v) => onChange(index, 'requiredSkillId', v === '__none__' ? '' : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Any skill" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs">Any skill</SelectItem>
          {skills.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Headcount */}
      <Input
        type="number"
        min="1"
        max="50"
        value={shift.headcount}
        onChange={(e) => onChange(index, 'headcount', e.target.value)}
        className="h-8 w-16 text-xs text-center"
      />

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={() => onRemove(index)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── New template sheet form ──────────────────────────────────────────────────

function NewTemplateSheet({
  open,
  onOpenChange,
  locations,
  skills,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locations: Location[];
  skills: Skill[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [shiftRows, setShiftRows] = useState<ShiftDraft[]>([emptyShiftRow()]);

  function resetForm() {
    setName('');
    setLocationId('');
    setShiftRows([emptyShiftRow()]);
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const shifts: TemplateShift[] = shiftRows.map((r) => ({
        dayOfWeek: parseInt(r.dayOfWeek),
        startTime: r.startTime,
        endTime: r.endTime,
        requiredSkillId: r.requiredSkillId || null,
        headcount: parseInt(r.headcount) || 1,
        notes: null,
      }));
      return scheduleTemplatesApi.create({ name, locationId, shifts });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created');
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleShiftChange(index: number, field: keyof ShiftDraft, value: string) {
    setShiftRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function handleShiftRemove(index: number) {
    setShiftRows((prev) => prev.filter((_, i) => i !== index));
  }

  const canSave = name.trim() && locationId && shiftRows.length > 0;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Schedule Template</SheetTitle>
          <SheetDescription>
            Define a reusable shift pattern that can be applied to any week.
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 auto-rows-min gap-5 px-4 py-2">
          {/* Name */}
          <div className="grid gap-2">
            <Label>Template name</Label>
            <Input
              placeholder="e.g. Summer Weekday Standard"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="grid gap-2">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shifts builder */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Shifts ({shiftRows.length})</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setShiftRows((prev) => [...prev, emptyShiftRow()])}
              >
                <Plus className="h-3 w-3" /> Add shift
              </Button>
            </div>

            {/* Column headers */}
            {shiftRows.length > 0 && (
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-2 text-[0.625rem] uppercase tracking-widest text-muted-foreground font-semibold px-0.5">
                <span className="w-32">Day</span>
                <span>Start</span>
                <span>End</span>
                <span>Skill</span>
                <span className="w-16 text-center">Staff</span>
                <span className="w-8" />
              </div>
            )}

            <div className="space-y-2">
              {shiftRows.map((row, i) => (
                <ShiftRowEditor
                  key={i}
                  shift={row}
                  index={i}
                  skills={skills}
                  onChange={handleShiftChange}
                  onRemove={handleShiftRemove}
                />
              ))}
            </div>

            {shiftRows.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No shifts added yet.</p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSave || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create template'}
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Apply-to-week dialog ─────────────────────────────────────────────────────

function ApplyDialog({
  template,
  onClose,
}: {
  template: ScheduleTemplate;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState('');

  // Only allow Mondays
  function isMonday(date: Date) {
    return getDay(date) === 1;
  }

  const applyMutation = useMutation({
    mutationFn: () => scheduleTemplatesApi.apply(template.id, weekStart),
    onSuccess: (data: { shiftsCreated?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(
        `Template applied — ${data?.shiftsCreated ?? 'some'} shift${data?.shiftsCreated !== 1 ? 's' : ''} created`,
      );
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply to Week</DialogTitle>
          <DialogDescription>
            Choose the Monday of the week to populate with &ldquo;{template.name}&rdquo; shifts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Week start (Monday)</Label>
            {/* We use a custom wrapper around DatePicker to restrict to Mondays.
                The Calendar component accepts a disabled prop but DatePicker wraps it;
                we render it with a note and validate on submit. */}
            <DatePicker
              value={weekStart || undefined}
              onChange={(v) => {
                // Enforce Monday selection
                const d = parseISO(v);
                if (getDay(d) !== 1) {
                  toast.error('Please select a Monday');
                  return;
                }
                setWeekStart(v);
              }}
              placeholder="Pick a Monday"
              className="w-full"
            />
            <p className="text-[0.625rem] text-muted-foreground">Select the Monday of the target week</p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={!weekStart || applyMutation.isPending}
            className="gap-2"
          >
            <CalendarCheck className="h-4 w-4" />
            {applyMutation.isPending ? 'Applying…' : 'Apply Template'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  canDelete,
}: {
  template: ScheduleTemplate;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => scheduleTemplatesApi.remove(template.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
      setDeleteOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Summarise which days this template covers
  const dayLabels = Array.from(new Set(template.shifts.map((s) => s.dayOfWeek)))
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ');

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{template.location?.name ?? 'Unknown location'}</p>
        </CardHeader>
        <CardContent className="flex-1 pb-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Shifts:</span>
            <span className="font-medium">{template.shifts.length}</span>
          </div>
          {dayLabels && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Days:</span>
              <span className="text-xs">{dayLabels}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Created:</span>
            <span className="text-xs">{format(parseISO(template.createdAt), 'MMM d, yyyy')}</span>
          </div>
        </CardContent>
        <CardFooter className="gap-2 pt-0">
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => setApplyOpen(true)}
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            Apply to Week
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Apply dialog */}
      {applyOpen && (
        <ApplyDialog template={template} onClose={() => setApplyOpen(false)} />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{template.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the template. Shifts already created from it will not be
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScheduleTemplatesPage() {
  const { user } = useAuth();
  const [locationFilter, setLocationFilter] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
  });

  const { data: templates = [], isLoading } = useQuery<ScheduleTemplate[]>({
    queryKey: ['templates', locationFilter],
    queryFn: () => scheduleTemplatesApi.list(locationFilter === 'all' ? undefined : locationFilter),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule Templates</h1>
          <p className="text-muted-foreground text-sm">
            Reusable shift patterns — apply to any week in one click
          </p>
        </div>
        <Button className="gap-2" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Location filter */}
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia>
            <EmptyTitle>No templates yet</EmptyTitle>
            <EmptyDescription>
              Create a schedule template to define repeating shift patterns and apply them to any week.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="gap-2" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} canDelete={canDelete} />
          ))}
        </div>
      )}

      {/* New template sheet */}
      <NewTemplateSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        locations={locations}
        skills={skills}
      />
    </div>
  );
}
