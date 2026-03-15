"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { PlusCircle, CheckCircle2, Trash2, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { checklistsApi, locationsApi, getErrorMessage } from "@/lib/api";
import { Checklist, ChecklistType, Location } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ChecklistType, string> = {
  opening: "Opening",
  closing: "Closing",
  custom: "Custom",
};

const TYPE_BADGE_CLASSES: Record<ChecklistType, string> = {
  opening:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
  closing:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  custom:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

const ALL_TYPES = "all";

interface NewItem {
  label: string;
  required: boolean;
}

const EMPTY_FORM = {
  type: "opening" as ChecklistType,
  title: "",
  locationId: "",
  items: [{ label: "", required: false }] as NewItem[],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChecklistsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === "admin" || user?.role === "manager";

  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterType, setFilterType] = useState<string>(ALL_TYPES);
  const [filterDate, setFilterDate] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // ── Queries ──

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: locationsApi.list,
  });

  const {
    data: checklists = [],
    isLoading,
    isError,
  } = useQuery<Checklist[]>({
    queryKey: ["checklists", filterLocation, filterDate],
    queryFn: () =>
      checklistsApi.list({
        locationId: filterLocation || undefined,
        date: filterDate || undefined,
      }),
  });

  // ── Mutations ──

  const completeItemMutation = useMutation({
    mutationFn: ({
      checklistId,
      itemId,
    }: {
      checklistId: string;
      itemId: string;
    }) => checklistsApi.completeItem(checklistId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      checklistsApi.create({
        type: form.type,
        title: form.title,
        locationId: form.locationId,
        items: form.items.filter((i) => i.label.trim()),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast.success("Checklist created");
      setSheetOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Filtered checklists ──

  const filtered = checklists.filter((c) => {
    if (filterType !== ALL_TYPES && c.type !== filterType) return false;
    return true;
  });

  // ── Item helpers ──

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { label: "", required: false }],
    }));

  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx: number, patch: Partial<NewItem>) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      ),
    }));

  const canCreate =
    form.title.trim() &&
    form.locationId &&
    form.items.some((i) => i.label.trim()) &&
    !createMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} checklist{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setSheetOpen(true);
            }}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New Checklist
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={filterLocation || "__all__"}
          onValueChange={(v) => setFilterLocation(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            <SelectItem value="opening">Opening</SelectItem>
            <SelectItem value="closing">Closing</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <DatePicker
          value={filterDate || undefined}
          onChange={(v) => setFilterDate(v)}
          placeholder="Filter by date"
          className="w-44"
        />

        {(filterLocation || filterType !== ALL_TYPES || filterDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterLocation("");
              setFilterType(ALL_TYPES);
              setFilterDate("");
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Grid */}
      {isError ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="font-medium text-destructive">
            Failed to load checklists
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Please refresh the page or try again.
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">
            No checklists found
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {canManage
              ? "Create a new checklist to get started."
              : "No checklists match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((checklist) => {
            const total = checklist.items.length;
            const completed = checklist.items.filter(
              (i) => i.completedAt !== null,
            ).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div
                key={checklist.id}
                className="border rounded-xl p-4 flex flex-col gap-3 bg-card hover:shadow-sm transition-shadow"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-medium",
                          TYPE_BADGE_CLASSES[checklist.type],
                        )}
                      >
                        {TYPE_LABELS[checklist.type]}
                      </Badge>
                      {checklist.isCompleted && (
                        <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm mt-1.5 truncate">
                      {checklist.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {checklist.location.name}
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {completed}/{total} items
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>

                {/* Items */}
                {total > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {checklist.items.map((item) => {
                      const isDone = item.completedAt !== null;
                      return (
                        <div key={item.id} className="flex items-start gap-2">
                          <Checkbox
                            id={`item-${item.id}`}
                            checked={isDone}
                            disabled={isDone || completeItemMutation.isPending}
                            onCheckedChange={() => {
                              if (!isDone) {
                                completeItemMutation.mutate({
                                  checklistId: checklist.id,
                                  itemId: item.id,
                                });
                              }
                            }}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`item-${item.id}`}
                              className={cn(
                                "text-xs leading-snug cursor-pointer",
                                isDone
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground",
                              )}
                            >
                              {item.label}
                              {item.required && !isDone && (
                                <span className="ml-1 text-red-500">*</span>
                              )}
                            </label>
                            {isDone && item.completedAt && (
                              <p className="text-[0.6rem] text-muted-foreground mt-0.5">
                                {format(
                                  new Date(item.completedAt),
                                  "MMM d, HH:mm",
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Checklist Sheet ── */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) setSheetOpen(false);
        }}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Checklist</SheetTitle>
            <SheetDescription>
              Create a checklist for a shift or location.
            </SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as ChecklistType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opening">Opening</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Morning Opening Checklist"
              />
            </div>

            <div className="grid gap-3">
              <Label>Location</Label>
              <Select
                value={form.locationId}
                onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a location…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items builder */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Checklist items</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={item.label}
                      onChange={(e) =>
                        updateItem(idx, { label: e.target.value })
                      }
                      placeholder={`Item ${idx + 1}`}
                      className="flex-1 text-sm"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Checkbox
                        id={`req-${idx}`}
                        checked={item.required}
                        onCheckedChange={(checked) =>
                          updateItem(idx, { required: !!checked })
                        }
                      />
                      <label
                        htmlFor={`req-${idx}`}
                        className="text-xs text-muted-foreground whitespace-nowrap"
                      >
                        Required
                      </label>
                    </div>
                    {form.items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canCreate}
            >
              {createMutation.isPending ? "Creating…" : "Create checklist"}
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
