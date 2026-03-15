"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  LayoutTemplate,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DataTable } from "@/components/ui/data-table";
import { locationsApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Location } from "@/lib/types";

const TIMEZONES = [
  // Americas
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Pacific/Honolulu",
  // Europe
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  // Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Casablanca",
  // Middle East
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kuwait",
  "Asia/Jerusalem",
  // Asia
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Asia/Karachi",
  "Asia/Tashkent",
  "Asia/Almaty",
  "Asia/Bangkok",
  "Asia/Ho_Chi_Minh",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  // Oceania
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

const emptyForm = { name: "", timezone: "America/New_York", address: "" };

export default function LocationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: locations = [], isLoading: locationsLoading } = useQuery<
    Location[]
  >({
    queryKey: ["locations"],
    queryFn: locationsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => locationsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location created");
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => locationsApi.update(editLoc!.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location updated");
      setEditLoc(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location removed");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const LocationFormFields = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <Label>Name</Label>
        <Input
          placeholder="North Beach"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid gap-3">
        <Label>Timezone</Label>
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
        >
          {Object.entries(
            TIMEZONES.reduce<Record<string, string[]>>((acc, tz) => {
              const region = tz.split("/")[0];
              (acc[region] = acc[region] ?? []).push(tz);
              return acc;
            }, {}),
          ).map(([region, tzs]) => (
            <optgroup key={region} label={region}>
              {tzs.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.split("/").slice(1).join("/").replace(/_/g, " ")}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid gap-3">
        <Label>Address</Label>
        <Input
          placeholder="123 Ocean Dr"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>
    </div>
  );

  const columns: ColumnDef<Location>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "timezone",
      header: "Timezone",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.original.timezone}
        </Badge>
      ),
    },
    { accessorKey: "address", header: "Address" },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                href={`/locations/${row.original.id}`}
                className="flex items-center gap-2"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                View layout
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditLoc(row.original);
                setForm({
                  name: row.original.name,
                  timezone: row.original.timezone,
                  address: row.original.address,
                });
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteMutation.mutate(row.original.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (user === null) return null;
  if (user.role !== "admin")
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-muted-foreground">
        <ShieldAlert className="h-10 w-10 opacity-40" />
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm mt-1">
            Only administrators can manage locations.
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground text-sm">
            {locations.length} Coastal Eats locations
          </p>
        </div>

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => setForm(emptyForm)}>
              <Plus className="h-4 w-4 mr-2" /> Add location
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Location</SheetTitle>
              <SheetDescription>
                Create a new Coastal Eats location with its timezone.
              </SheetDescription>
            </SheetHeader>
            <LocationFormFields />
            <SheetFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create location"}
              </Button>
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <DataTable
        columns={columns}
        data={locations}
        isLoading={locationsLoading}
        searchKey="name"
        searchPlaceholder="Search locations…"
        emptyState={
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPin />
              </EmptyMedia>
              <EmptyTitle>No locations yet</EmptyTitle>
              <EmptyDescription>
                Add your first Coastal Eats location to start building
                schedules.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => {
                  setForm(emptyForm);
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add location
              </Button>
            </EmptyContent>
          </Empty>
        }
      />

      <Sheet
        open={!!editLoc}
        onOpenChange={(open) => !open && setEditLoc(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Location</SheetTitle>
            <SheetDescription>
              Update the location details and timezone.
            </SheetDescription>
          </SheetHeader>
          <LocationFormFields />
          <SheetFooter>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!form.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
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
