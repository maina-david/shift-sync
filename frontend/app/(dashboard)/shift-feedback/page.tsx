"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shiftFeedbackApi, locationsApi } from "@/lib/api";
import { Location, ShiftFeedback, FeedbackSummary } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";

/** Render filled/empty stars for a 1–5 rating */
function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
        />
      ))}
    </span>
  );
}

function BoolChip({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean | null;
  trueLabel: string;
  falseLabel: string;
}) {
  if (value === null) return null;
  return (
    <Badge
      variant="outline"
      className={
        value
          ? "border-green-500/40 text-green-700 bg-green-500/10"
          : "border-muted-foreground/30 text-muted-foreground bg-muted/40"
      }
    >
      {value ? trueLabel : falseLabel}
    </Badge>
  );
}

function MyFeedbackTab() {
  const { data: feedbackList = [], isLoading } = useQuery<ShiftFeedback[]>({
    queryKey: ["shift-feedback", "mine"],
    queryFn: shiftFeedbackApi.getMine,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (feedbackList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Star className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-muted-foreground">No feedback yet</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          You haven&apos;t submitted any shift feedback yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feedbackList.map((fb) => {
        const shift = fb.assignment?.shift;
        return (
          <Card key={fb.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-medium text-sm">
                    {shift?.date
                      ? format(
                          new Date(shift.date + "T00:00:00"),
                          "EEE, MMM d, yyyy",
                        )
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shift?.location?.name ?? "—"}
                    {shift?.startTime && shift?.endTime && (
                      <span className="ml-1.5 tabular-nums">
                        {shift.startTime}–{shift.endTime}
                      </span>
                    )}
                  </p>
                </div>
                <RatingStars rating={fb.rating} />
              </div>
              {fb.comment && (
                <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                  {fb.comment}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <BoolChip
                  value={fb.adequatelyStaffed}
                  trueLabel="Adequately staffed"
                  falseLabel="Understaffed"
                />
                <BoolChip
                  value={fb.wouldRepeat}
                  trueLabel="Would repeat"
                  falseLabel="Would not repeat"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TeamFeedbackTab() {
  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [locationId, setLocationId] = useState("all");

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: locationsApi.list,
  });

  const params = {
    locationId: locationId === "all" ? undefined : locationId,
    startDate,
    endDate,
  };

  const { data: summary, isLoading: summaryLoading } =
    useQuery<FeedbackSummary>({
      queryKey: ["shift-feedback", "summary", params],
      queryFn: () => shiftFeedbackApi.getSummary(params),
    });

  const statCards = [
    {
      label: "Avg Rating",
      value: summary ? (
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold tabular-nums">
            {summary.averageRating != null
              ? Number(summary.averageRating).toFixed(1)
              : "—"}
          </span>
          {summary.averageRating != null && (
            <RatingStars rating={Math.round(summary.averageRating)} />
          )}
        </div>
      ) : null,
    },
    {
      label: "Total Responses",
      value: summary ? (
        <span className="text-3xl font-bold tabular-nums">
          {summary.totalResponses}
        </span>
      ) : null,
    },
    {
      label: "% Adequately Staffed",
      value: summary ? (
        <span className="text-3xl font-bold tabular-nums text-green-600">
          {summary.pctAdequatelyStaffed != null
            ? `${Number(summary.pctAdequatelyStaffed).toFixed(0)}%`
            : "—"}
        </span>
      ) : null,
    },
    {
      label: "% Would Repeat",
      value: summary ? (
        <span className="text-3xl font-bold tabular-nums text-blue-600">
          {summary.pctWouldRepeat != null
            ? `${Number(summary.pctWouldRepeat).toFixed(0)}%`
            : "—"}
        </span>
      ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? <Skeleton className="h-8 w-20" /> : card.value}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Start date"
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="End date"
            className="w-40"
          />
        </div>
      </div>

      {/* Table — reuse the summary endpoint; if it includes per-shift rows, show them */}
      {summaryLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !summary || summary.totalResponses === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Star className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No responses yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            No team feedback submitted for this period.
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Summary</CardTitle>
            <CardDescription>
              {startDate} – {endDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Total Responses</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {summary.totalResponses}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Average Rating</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular-nums font-medium">
                        {summary.averageRating != null
                          ? Number(summary.averageRating).toFixed(2)
                          : "—"}
                      </span>
                      {summary.averageRating != null && (
                        <RatingStars
                          rating={Math.round(summary.averageRating)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Adequately Staffed</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-green-600">
                    {summary.pctAdequatelyStaffed != null
                      ? `${Number(summary.pctAdequatelyStaffed).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Would Repeat</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-blue-600">
                    {summary.pctWouldRepeat != null
                      ? `${Number(summary.pctWouldRepeat).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ShiftFeedbackPage() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
          <Star className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Feedback</h1>
          <p className="text-muted-foreground text-sm">
            Post-shift ratings and team insights
          </p>
        </div>
      </div>

      <Tabs defaultValue="my-feedback">
        <TabsList>
          <TabsTrigger value="my-feedback">My Feedback</TabsTrigger>
          {isManager && (
            <TabsTrigger value="team-feedback">Team Feedback</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-feedback" className="mt-4">
          <MyFeedbackTab />
        </TabsContent>

        {isManager && (
          <TabsContent value="team-feedback" className="mt-4">
            <TeamFeedbackTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
