'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, UserPlus, ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { usersApi, locationsApi, skillsApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { User, Location, Skill } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['', 'bg-destructive', 'bg-chart-warning', 'bg-yellow-400', 'bg-chart-success', 'bg-chart-success'];
  return { score, label: labels[score] ?? 'Strong', color: colors[score] ?? 'bg-chart-success' };
}

const EMPTY_CREATE = { name: '', email: '', password: '', role: 'staff' };

export default function StaffPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    desiredHoursPerWeek: '40',
    hourlyRate: '',
    skillIds: [] as string[],
    certifiedLocationIds: [] as string[],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data: staff = [], isLoading: staffLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(createForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Staff member created');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Staff member updated');
      setEditUser(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      toast.success('Password reset successfully');
      setResetUser(null);
      setNewPassword('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openEdit = (u: User) => {
    setEditForm({
      name: u.name,
      desiredHoursPerWeek: String(u.desiredHoursPerWeek ?? 40),
      hourlyRate: u.hourlyRate != null ? String(u.hourlyRate) : '',
      skillIds: u.skills?.map((s) => s.id) ?? [],
      certifiedLocationIds: u.certifiedLocations?.map((l) => l.id) ?? [],
    });
    setEditUser(u);
  };

  const toggleSkill = (id: string) =>
    setEditForm((f) => ({
      ...f,
      skillIds: f.skillIds.includes(id) ? f.skillIds.filter((s) => s !== id) : [...f.skillIds, id],
    }));

  const toggleLocation = (id: string) =>
    setEditForm((f) => ({
      ...f,
      certifiedLocationIds: f.certifiedLocationIds.includes(id)
        ? f.certifiedLocationIds.filter((l) => l !== id)
        : [...f.certifiedLocationIds, id],
    }));

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting()}>
          Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">{row.original.role}</Badge>
      ),
    },
    {
      id: 'skills',
      header: 'Skills',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.skills?.slice(0, 3).map((s) => (
            <Badge key={s.id} variant="secondary" className="text-xs">{s.name}</Badge>
          ))}
          {(row.original.skills?.length ?? 0) > 3 && (
            <Badge variant="secondary" className="text-xs">+{(row.original.skills?.length ?? 0) - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      id: 'locations',
      header: 'Locations',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.certifiedLocations?.slice(0, 2).map((l) => (
            <Badge key={l.id} variant="outline" className="text-xs">{l.name}</Badge>
          ))}
          {(row.original.certifiedLocations?.length ?? 0) > 2 && (
            <Badge variant="outline" className="text-xs">
              +{(row.original.certifiedLocations?.length ?? 0) - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'desiredHoursPerWeek',
      header: 'Hrs/wk',
      cell: ({ row }) => row.original.desiredHoursPerWeek || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>Edit</DropdownMenuItem>
            {user?.role === 'admin' && (
              <DropdownMenuItem
                onClick={() => {
                  setNewPassword('');
                  setShowNewPassword(false);
                  setResetUser(row.original);
                }}
              >
                Reset password
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                updateMutation.mutate({
                  id: row.original.id,
                  data: { isActive: !row.original.isActive },
                })
              }
            >
              {row.original.isActive ? 'Deactivate' : 'Activate'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground text-sm">
            {staff.length} team members across all locations
          </p>
        </div>
        {user?.role === 'admin' && (
          <Button onClick={() => { setCreateForm(EMPTY_CREATE); setShowCreatePassword(false); setCreateOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-2" /> Add staff
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={staff}
        isLoading={staffLoading}
        searchKey="name"
        searchPlaceholder="Search staff…"
        emptyState={
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><UserPlus /></EmptyMedia>
              <EmptyTitle>No staff members yet</EmptyTitle>
              <EmptyDescription>Add your first team member to get started with scheduling.</EmptyDescription>
            </EmptyHeader>
            {user?.role === 'admin' && (
              <EmptyContent>
                <Button onClick={() => { setCreateForm(EMPTY_CREATE); setShowCreatePassword(false); setCreateOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-2" /> Add staff member
                </Button>
              </EmptyContent>
            )}
          </Empty>
        }
      />

      {/* Create staff */}
      <Sheet open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add staff member</SheetTitle>
            <SheetDescription>Create a new account. Share the credentials directly.</SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Full name</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-3">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-3">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm({ ...createForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !createForm.name || !createForm.email ||
                createForm.password.length < 12 ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? 'Creating…' : 'Create account'}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit staff */}
      <Sheet open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit {editUser?.name}</SheetTitle>
            <SheetDescription>Update skills, locations, and profile details.</SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Full name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="grid gap-3">
              <Label>Desired hours / week</Label>
              <Input
                type="number"
                min="0"
                className="w-24"
                value={editForm.desiredHoursPerWeek}
                onChange={(e) => setEditForm({ ...editForm, desiredHoursPerWeek: e.target.value })}
              />
            </div>

            <div className="grid gap-3">
              <Label>Hourly rate ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="w-28"
                placeholder="e.g. 18.50"
                value={editForm.hourlyRate}
                onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
              />
            </div>

            <div className="grid gap-3">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Badge
                    key={s.id}
                    variant={editForm.skillIds.includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleSkill(s.id)}
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Certified locations</Label>
              <div className="flex flex-wrap gap-2">
                {locations.map((l) => (
                  <Badge
                    key={l.id}
                    variant={editForm.certifiedLocationIds.includes(l.id) ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleLocation(l.id)}
                  >
                    {l.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() =>
                editUser &&
                updateMutation.mutate({
                  id: editUser.id,
                  data: {
                    name: editForm.name,
                    desiredHoursPerWeek: parseInt(editForm.desiredHoursPerWeek, 10),
                    hourlyRate: editForm.hourlyRate !== '' ? parseFloat(editForm.hourlyRate) : null,
                    skillIds: editForm.skillIds,
                    certifiedLocationIds: editForm.certifiedLocationIds,
                  },
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reset password */}
      <Dialog
        open={!!resetUser}
        onOpenChange={(open) => {
          if (!open) { setResetUser(null); setNewPassword(''); }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-medium">{resetUser?.name}</span>.
              They will need to use this on their next login.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (() => {
              const s = passwordStrength(newPassword);
              return (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= s.score ? s.color : 'bg-muted'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                resetUser &&
                resetPasswordMutation.mutate({ id: resetUser.id, password: newPassword })
              }
              disabled={newPassword.length < 12 || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
