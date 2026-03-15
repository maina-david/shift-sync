"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usersApi, getErrorMessage } from "@/lib/api";
import { Availability, AvailabilityException } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type AvailSlot = { dayOfWeek: number; startTime: string; endTime: string };

export default function AvailabilityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [slots, setSlots] = useState<AvailSlot[]>([]);
  const [exSheetOpen, setExSheetOpen] = useState(false);
  const [newException, setNewException] = useState({
    date: "",
    startTime: "09:00",
    endTime: "17:00",
    isUnavailable: false,
  });

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["availability", user?.id],
    queryFn: () => usersApi.getAvailability(user?.id ?? ""),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (availability?.slots) {
      setSlots(
        availability.slots.map((s: Availability) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      );
    }
  }, [availability]);

  const saveMutation = useMutation({
    mutationFn: () => usersApi.setAvailability(user?.id ?? "", slots),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] });
      toast.success("Availability saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const addExceptionMutation = useMutation({
    mutationFn: () =>
      usersApi.addException(user!.id, {
        date: newException.date,
        startTime: newException.isUnavailable
          ? undefined
          : newException.startTime,
        endTime: newException.isUnavailable ? undefined : newException.endTime,
        isUnavailable: newException.isUnavailable,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] });
      toast.success("Exception added");
      setNewException({
        date: "",
        startTime: "09:00",
        endTime: "17:00",
        isUnavailable: false,
      });
      setExSheetOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeExceptionMutation = useMutation({
    mutationFn: (exId: string) => usersApi.removeException(user!.id, exId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] });
      toast.success("Exception removed");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleDay = (dayOfWeek: number) => {
    if (slots.some((s) => s.dayOfWeek === dayOfWeek)) {
      setSlots((prev) => prev.filter((s) => s.dayOfWeek !== dayOfWeek));
    } else {
      setSlots((prev) =>
        [...prev, { dayOfWeek, startTime: "09:00", endTime: "17:00" }].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek,
        ),
      );
    }
  };

  const updateSlot = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s,
      ),
    );
  };

  if (user && user.role !== "staff")
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <ShieldAlert className="h-10 w-10 opacity-40" />
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm mt-1">
            Availability settings are only available to staff members.
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Availability</h1>
        <p className="text-muted-foreground text-sm">
          Set your recurring weekly hours and any one-off exceptions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Availability</CardTitle>
          <CardDescription>
            Times are interpreted in the location's timezone for each shift
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {DAYS.map((day, dayOfWeek) => {
              const slot = slots.find((s) => s.dayOfWeek === dayOfWeek);
              const isActive = !!slot;
              return (
                <div key={dayOfWeek} className="flex items-center gap-3">
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => toggleDay(dayOfWeek)}
                    className="shrink-0"
                  />
                  <div
                    className={`flex items-center gap-3 flex-1 ${!isActive && "opacity-40 pointer-events-none"}`}
                  >
                    <span className="w-24 text-sm font-medium">{day}</span>
                    <TimePicker
                      value={slot?.startTime ?? "09:00"}
                      onChange={(v) => updateSlot(dayOfWeek, "startTime", v)}
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <TimePicker
                      value={slot?.endTime ?? "17:00"}
                      onChange={(v) => updateSlot(dayOfWeek, "endTime", v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save availability"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">One-off Exceptions</CardTitle>
            <CardDescription>
              Override your availability for specific dates
            </CardDescription>
          </div>
          <Sheet open={exSheetOpen} onOpenChange={setExSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setNewException({
                    date: "",
                    startTime: "09:00",
                    endTime: "17:00",
                    isUnavailable: false,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add exception
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add Availability Exception</SheetTitle>
                <SheetDescription>
                  Override your availability for a specific date.
                </SheetDescription>
              </SheetHeader>
              <div className="grid flex-1 auto-rows-min gap-6 px-4">
                <div className="grid gap-3">
                  <Label>Date</Label>
                  <DatePicker
                    value={newException.date || undefined}
                    onChange={(v) =>
                      setNewException({ ...newException, date: v })
                    }
                    placeholder="Pick date"
                    className="w-44"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={newException.isUnavailable}
                    onCheckedChange={(v) =>
                      setNewException({ ...newException, isUnavailable: v })
                    }
                  />
                  <Label>Completely unavailable this day</Label>
                </div>
                {!newException.isUnavailable && (
                  <div className="grid gap-4">
                    <div className="grid gap-3">
                      <Label>Start time</Label>
                      <TimePicker
                        value={newException.startTime}
                        onChange={(v) =>
                          setNewException({ ...newException, startTime: v })
                        }
                      />
                    </div>
                    <div className="grid gap-3">
                      <Label>End time</Label>
                      <TimePicker
                        value={newException.endTime}
                        onChange={(v) =>
                          setNewException({ ...newException, endTime: v })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
              <SheetFooter>
                <Button
                  onClick={() => addExceptionMutation.mutate()}
                  disabled={
                    !newException.date || addExceptionMutation.isPending
                  }
                >
                  {addExceptionMutation.isPending ? "Adding…" : "Add exception"}
                </Button>
                <SheetClose asChild>
                  <Button variant="outline">Cancel</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </CardHeader>
        <CardContent className="space-y-2">
          {availabilityLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !availability?.exceptions?.length ? (
            <p className="text-sm text-muted-foreground">No exceptions set.</p>
          ) : (
            <>
              {availability.exceptions.map((ex: AvailabilityException) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div>
                    <span className="text-sm font-medium">{ex.date}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {ex.isUnavailable ? (
                        <Badge variant="destructive" className="text-xs">
                          Unavailable
                        </Badge>
                      ) : (
                        `${ex.startTime}–${ex.endTime}`
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeExceptionMutation.mutate(ex.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Separator className="mt-2" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
