'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { analyticsApi, locationsApi } from '@/lib/api';
import { Location, HoursDistributionEntry, FairnessReport, OvertimeEntry } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useChartColors() {
  return {
    primary: cssVar('--chart-1'),
    warning: cssVar('--chart-warning'),
    danger: cssVar('--destructive'),
    success: cssVar('--chart-success'),
    muted: cssVar('--muted-foreground'),
    border: cssVar('--border'),
  };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-xl text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill ?? p.color }} className="tabular-nums">
          {p.name}: {p.value}h
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [weekStart, setWeekStart] = useState(thisWeekStart);
  const [locationId, setLocationId] = useState('all');

  const colors = useChartColors();

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const { data: hours = [], isLoading: hoursLoading } = useQuery<HoursDistributionEntry[]>({
    queryKey: ['analytics', 'hours', startDate, endDate, locationId],
    queryFn: () => analyticsApi.hoursDistribution(startDate, endDate, locationId === 'all' ? undefined : locationId),
  });

  const { data: fairness, isLoading: fairnessLoading } = useQuery<FairnessReport>({
    queryKey: ['analytics', 'fairness', startDate, endDate, locationId],
    queryFn: () => analyticsApi.fairness(startDate, endDate, locationId === 'all' ? undefined : locationId),
  });

  const { data: overtime = [], isLoading: overtimeLoading } = useQuery<OvertimeEntry[]>({
    queryKey: ['analytics', 'overtime', weekStart, locationId],
    queryFn: () => analyticsApi.overtime(weekStart, locationId === 'all' ? undefined : locationId),
  });

  function barColor(totalHours: number) {
    if (totalHours > 40) return colors.danger;
    if (totalHours >= 35) return colors.warning;
    return colors.primary;
  }

  function scoreColor(score: number) {
    if (score >= 0.8) return colors.success;
    if (score >= 0.5) return colors.warning;
    return colors.danger;
  }

  function scoreLabel(score: number) {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">Labor insights and fairness reports</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={locationId} onValueChange={setLocationId}>
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

      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Hours Distribution</TabsTrigger>
          <TabsTrigger value="fairness">Fairness</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" className="w-40" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours per Staff Member</CardTitle>
              <CardDescription>{startDate} – {endDate}</CardDescription>
            </CardHeader>
            <CardContent>
              {hoursLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : hours.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data for this period.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--chart-1)` }} />
                      Normal
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--chart-warning)` }} />
                      Near limit (35–40h)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--destructive)` }} />
                      Overtime (&gt;40h)
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height={Math.max(200, hours.slice(0, 15).length * 36)}>
                    <BarChart data={hours.slice(0, 15)} layout="vertical" margin={{ left: 80, right: 20, top: 4, bottom: 4 }}>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: colors.muted }}
                        axisLine={{ stroke: colors.border }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: colors.muted }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="totalHours" name="Hours" radius={[0, 4, 4, 0]}>
                        {hours.slice(0, 15).map((entry, i) => (
                          <Cell key={i} fill={barColor(entry.totalHours)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {hours.map((entry) => (
                      <div key={entry.staffId} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-32">{entry.name}</span>
                        <div className="flex items-center gap-2">
                          {entry.desiredHoursPerWeek > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              target: {entry.desiredHoursPerWeek}h/wk
                            </span>
                          )}
                          <Badge
                            style={{
                              background: `color-mix(in oklch, ${barColor(entry.totalHours)} 15%, transparent)`,
                              color: barColor(entry.totalHours),
                              borderColor: `color-mix(in oklch, ${barColor(entry.totalHours)} 30%, transparent)`,
                            }}
                            className="border tabular-nums"
                          >
                            {entry.totalHours}h
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fairness" className="space-y-4 mt-4">
          {fairnessLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !fairness ? null : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold">Fairness Score</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Equal distribution of premium shifts (Fri/Sat evenings)
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span
                          className="text-3xl font-bold tabular-nums"
                          style={{ color: scoreColor(fairness.fairnessScore) }}
                        >
                          {(fairness.fairnessScore * 100).toFixed(0)}
                        </span>
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: scoreColor(fairness.fairnessScore) }}
                      >
                        {scoreLabel(fairness.fairnessScore)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fairness.fairnessScore * 100}%`,
                        background: scoreColor(fairness.fairnessScore),
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Premium Shift Distribution</CardTitle>
                  <CardDescription>Friday & Saturday evening shifts (after 5pm)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fairness.staff.map((entry) => (
                    <div key={entry.staffId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {entry.premiumShifts} premium / {entry.totalShifts} total
                          <span className="ml-1 text-foreground/60">
                            ({(entry.premiumRatio * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${entry.premiumRatio * 100}%`,
                            background: 'var(--chart-1)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="overtime" className="space-y-4 mt-4">
          <div className="space-y-1">
            <Label className="text-xs">Week start (Monday)</Label>
            <DatePicker value={weekStart} onChange={setWeekStart} placeholder="Pick week" className="w-40" />
          </div>

          {overtimeLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : overtime.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts scheduled for this week.</p>
          ) : (
            <div className="space-y-3">
              {overtime.map((entry: OvertimeEntry) => {
                const trackColor = entry.isOvertime
                  ? colors.danger
                  : entry.isAtRisk
                  ? colors.warning
                  : colors.primary;
                return (
                  <Card
                    key={entry.staffId}
                    style={
                      entry.isOvertime
                        ? { borderColor: `color-mix(in oklch, var(--destructive) 30%, transparent)` }
                        : entry.isAtRisk
                        ? { borderColor: `color-mix(in oklch, var(--chart-warning) 30%, transparent)` }
                        : {}
                    }
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium">{entry.name}</p>
                        <div className="flex items-center gap-2">
                          {entry.isOvertime && (
                            <Badge
                              style={{
                                background: `color-mix(in oklch, var(--destructive) 15%, transparent)`,
                                color: 'var(--destructive)',
                                borderColor: `color-mix(in oklch, var(--destructive) 30%, transparent)`,
                              }}
                              className="border"
                            >
                              Overtime +{entry.overtimeHours}h
                              {entry.overtimeCost !== null && ` · $${entry.overtimeCost.toFixed(2)}`}
                            </Badge>
                          )}
                          {!entry.isOvertime && entry.isAtRisk && (
                            <Badge
                              style={{
                                background: `color-mix(in oklch, var(--chart-warning) 15%, transparent)`,
                                color: 'var(--chart-warning)',
                                borderColor: `color-mix(in oklch, var(--chart-warning) 30%, transparent)`,
                              }}
                              className="border"
                            >
                              At risk
                            </Badge>
                          )}
                          <span className="text-sm font-semibold tabular-nums">{entry.weeklyHours}h</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((entry.weeklyHours / 40) * 100, 100)}%`,
                            background: trackColor,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.assignments.map((a, i) => (
                          <Badge
                            key={i}
                            style={
                              a.isInOvertime
                                ? {
                                    background: `color-mix(in oklch, var(--destructive) 10%, transparent)`,
                                    color: 'var(--destructive)',
                                    borderColor: `color-mix(in oklch, var(--destructive) 25%, transparent)`,
                                  }
                                : a.isOvertimePusher
                                ? {
                                    background: `color-mix(in oklch, var(--chart-warning) 10%, transparent)`,
                                    color: 'var(--chart-warning)',
                                    borderColor: `color-mix(in oklch, var(--chart-warning) 25%, transparent)`,
                                  }
                                : {}
                            }
                            variant={!a.isInOvertime && !a.isOvertimePusher ? 'outline' : undefined}
                            className="border text-xs"
                          >
                            {a.date} {a.startTime}–{a.endTime}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
