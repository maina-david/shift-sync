'use client';

import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Preset = { label: string; start: string; end: string };

function getPresets(): Preset[] {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(weekStart, 1);
  const monthStart = startOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));

  return [
    { label: 'Today', start: fmt(today), end: fmt(today) },
    { label: 'This Week', start: fmt(weekStart), end: fmt(endOfWeek(today, { weekStartsOn: 1 })) },
    { label: 'Last Week', start: fmt(lastWeekStart), end: fmt(endOfWeek(lastWeekStart, { weekStartsOn: 1 })) },
    { label: 'This Month', start: fmt(monthStart), end: fmt(endOfMonth(today)) },
    { label: 'Last Month', start: fmt(lastMonthStart), end: fmt(endOfMonth(lastMonthStart)) },
  ];
}

interface DateRangePresetsProps {
  startDate: string;
  endDate: string;
  onSelect: (start: string, end: string) => void;
  className?: string;
}

export function DateRangePresets({ startDate, endDate, onSelect, className }: DateRangePresetsProps) {
  const presets = getPresets();

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {presets.map((p) => {
        const active = p.start === startDate && p.end === endDate;
        return (
          <Button
            key={p.label}
            size="sm"
            variant={active ? 'default' : 'outline'}
            className={cn('h-7 text-xs px-2.5', !active && 'text-muted-foreground')}
            onClick={() => onSelect(p.start, p.end)}
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
