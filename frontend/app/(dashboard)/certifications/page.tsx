'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BadgeCheck, PlusCircle, Trash2, AlertTriangle, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { certificationsApi, usersApi, getErrorMessage } from '@/lib/api';
import { Certification, User } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

// ─── Expiry logic ─────────────────────────────────────────────────────────────

type CertStatus = 'valid' | 'expiring' | 'expired';

function certStatus(expiryDate: string | null | undefined): CertStatus {
  if (!expiryDate) return 'expired';
  const d = new Date(expiryDate);
  if (isNaN(d.getTime())) return 'expired';
  const days = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

const STATUS_BADGE: Record<CertStatus, { label: string; className: string }> = {
  valid: {
    label: 'Valid',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  expiring: {
    label: 'Expiring Soon',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  },
  expired: {
    label: 'Expired',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
  },
};

function StatusBadge({ expiryDate }: { expiryDate: string }) {
  const s = certStatus(expiryDate);
  const { label, className } = STATUS_BADGE[s];
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  );
}

// ─── Form types ───────────────────────────────────────────────────────────────

const EMPTY_CERT_FORM = {
  name: '',
  issuer: '',
  issuedDate: '',
  expiryDate: '',
  documentUrl: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CertificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [certForm, setCertForm] = useState(EMPTY_CERT_FORM);
  const [forStaffId, setForStaffId] = useState('');
  const [isTeamDialog, setIsTeamDialog] = useState(false);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Team tab filter
  const [staffSearch, setStaffSearch] = useState('');

  // ── Queries ──

  const { data: myCerts = [], isLoading: myLoading } = useQuery<Certification[]>({
    queryKey: ['certifications-mine'],
    queryFn: certificationsApi.getMine,
  });

  type ExpiringCert = Certification & { user: User };

  const { data: expiring = [] } = useQuery<ExpiringCert[]>({
    queryKey: ['certifications-expiring'],
    queryFn: () => certificationsApi.getExpiring(30),
    enabled: canManage,
  });

  const { data: staffList = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: canManage,
  });

  // For team tab: load all certs per visible staff by collecting from expiring + getMine;
  // but we need all staff certs — use a combined approach: fetch per staff on demand.
  // Since there's no "get all" endpoint, we use getExpiring with a large window to build
  // the team table, supplemented by each staff member's own certs.
  const { data: allExpiring = [] } = useQuery<ExpiringCert[]>({
    queryKey: ['certifications-expiring-all'],
    queryFn: () => certificationsApi.getExpiring(36500), // ~100 years = all certs
    enabled: canManage,
  });

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: typeof EMPTY_CERT_FORM }) =>
      certificationsApi.create(userId, {
        name: data.name,
        issuedDate: data.issuedDate,
        expiryDate: data.expiryDate,
        issuer: data.issuer || undefined,
        documentUrl: data.documentUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications-mine'] });
      queryClient.invalidateQueries({ queryKey: ['certifications-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['certifications-expiring-all'] });
      toast.success('Certification added');
      setAddDialogOpen(false);
      setCertForm(EMPTY_CERT_FORM);
      setForStaffId('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => certificationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications-mine'] });
      queryClient.invalidateQueries({ queryKey: ['certifications-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['certifications-expiring-all'] });
      toast.success('Certification deleted');
      setDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Helpers ──

  const openAddMine = () => {
    setCertForm(EMPTY_CERT_FORM);
    setForStaffId(user?.id ?? '');
    setIsTeamDialog(false);
    setAddDialogOpen(true);
  };

  const openAddForTeam = () => {
    setCertForm(EMPTY_CERT_FORM);
    setForStaffId('');
    setIsTeamDialog(true);
    setAddDialogOpen(true);
  };

  const handleCreate = () => {
    const targetId = isTeamDialog ? forStaffId : (user?.id ?? '');
    if (!targetId) return;
    createMutation.mutate({
      userId: targetId,
      data: { ...certForm, name: certForm.name.trim(), issuer: certForm.issuer.trim() },
    });
  };

  const canSubmit =
    certForm.name.trim() &&
    certForm.issuedDate &&
    certForm.expiryDate &&
    certForm.expiryDate >= certForm.issuedDate &&
    (!isTeamDialog || forStaffId) &&
    !createMutation.isPending;

  // Team certs: group allExpiring by staff
  const teamCerts = allExpiring;
  const filteredTeamCerts = staffSearch.trim()
    ? teamCerts.filter((c) =>
        c.user.name.toLowerCase().includes(staffSearch.toLowerCase())
      )
    : teamCerts;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certifications</h1>
          <p className="text-muted-foreground text-sm">Manage staff certifications and expiry dates</p>
        </div>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My Certifications</TabsTrigger>
          {canManage && <TabsTrigger value="team">Team Certifications</TabsTrigger>}
        </TabsList>

        {/* ── My Certifications ── */}
        <TabsContent value="mine" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {myCerts.length} certification{myCerts.length !== 1 ? 's' : ''}
            </p>
            <Button size="sm" onClick={openAddMine}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          </div>

          {myLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
            </div>
          ) : myCerts.length === 0 ? (
            <div className="border rounded-lg p-12 text-center">
              <BadgeCheck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No certifications yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first certification to keep your records up to date.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {myCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="border rounded-xl p-4 flex flex-col gap-2.5 bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cert.name}</p>
                      {cert.issuer && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cert.issuer}</p>
                      )}
                    </div>
                    <StatusBadge expiryDate={cert.expiryDate} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Issued</p>
                      <p>{format(new Date(cert.issuedDate), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Expires</p>
                      <p className={cn(
                        certStatus(cert.expiryDate) === 'expired' && 'text-red-600',
                        certStatus(cert.expiryDate) === 'expiring' && 'text-yellow-600',
                      )}>
                        {format(new Date(cert.expiryDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  {cert.documentUrl && (
                    <a
                      href={cert.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View document
                    </a>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-end text-muted-foreground hover:text-destructive -mt-1"
                    onClick={() => setDeleteId(cert.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Team Certifications ── */}
        {canManage && (
          <TabsContent value="team" className="mt-4 space-y-4">
            {/* Expiring alert */}
            {expiring.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">{expiring.length} certification{expiring.length !== 1 ? 's' : ''}</span>
                  {' '}expiring within the next 30 days. Review the team tab below.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Filter by staff name…"
                  className="pl-8 text-sm"
                />
              </div>
              <Button size="sm" onClick={openAddForTeam}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Cert for Staff
              </Button>
            </div>

            {filteredTeamCerts.length === 0 ? (
              <div className="border rounded-lg p-12 text-center">
                <BadgeCheck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-medium text-muted-foreground">
                  {staffSearch ? 'No certifications match your search' : 'No team certifications on record'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Certification</TableHead>
                      <TableHead>Issuer</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeamCerts.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-medium text-sm">{cert.user.name}</TableCell>
                        <TableCell className="text-sm">{cert.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cert.issuer ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(cert.issuedDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className={cn(
                          'text-sm',
                          certStatus(cert.expiryDate) === 'expired' && 'text-red-600 font-medium',
                          certStatus(cert.expiryDate) === 'expiring' && 'text-yellow-600 font-medium',
                        )}>
                          {format(new Date(cert.expiryDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <StatusBadge expiryDate={cert.expiryDate} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(cert.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Add Certification Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isTeamDialog ? 'Add Certification for Staff' : 'Add Certification'}
            </DialogTitle>
            <DialogDescription>
              {isTeamDialog
                ? 'Record a certification for a team member.'
                : 'Add a new certification to your profile.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {isTeamDialog && (
              <div className="grid gap-2">
                <Label>Staff member</Label>
                <Select value={forStaffId} onValueChange={setForStaffId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Certification name</Label>
              <Input
                value={certForm.name}
                onChange={(e) => setCertForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Food Handler's Certificate"
              />
            </div>

            <div className="grid gap-2">
              <Label>Issuer</Label>
              <Input
                value={certForm.issuer}
                onChange={(e) => setCertForm((f) => ({ ...f, issuer: e.target.value }))}
                placeholder="e.g. National Restaurant Association"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Issued date</Label>
                <DatePicker
                  value={certForm.issuedDate || undefined}
                  onChange={(v) => setCertForm((f) => ({ ...f, issuedDate: v }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Expiry date</Label>
                <DatePicker
                  value={certForm.expiryDate || undefined}
                  onChange={(v) => setCertForm((f) => ({ ...f, expiryDate: v }))}
                />
              </div>
            </div>
            {certForm.issuedDate && certForm.expiryDate && certForm.expiryDate < certForm.issuedDate && (
              <p className="text-xs text-destructive">Expiry date must be on or after the issued date.</p>
            )}

            <div className="grid gap-2">
              <Label>Document URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="url"
                value={certForm.documentUrl}
                onChange={(e) => setCertForm((f) => ({ ...f, documentUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canSubmit}>
              {createMutation.isPending ? 'Saving…' : 'Save certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete certification?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The certification record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
