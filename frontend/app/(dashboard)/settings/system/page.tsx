'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, Sliders, ShieldAlert, MoreHorizontal, Pencil, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi, getErrorMessage } from '@/lib/api';
import { SystemSetting } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupSettings(settings: SystemSetting[]): Record<string, SystemSetting[]> {
  const groups: Record<string, SystemSetting[]> = {};
  for (const s of settings) {
    const prefix = s.key.includes('.') ? s.key.split('.')[0] : 'general';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(s);
  }
  return groups;
}

const GROUP_META: Record<string, { label: string; description: string }> = {
  scheduling: {
    label: 'Scheduling Rules',
    description: 'Controls shift assignment, overtime detection, and schedule publishing.',
  },
  payroll: {
    label: 'Payroll',
    description: 'Overtime thresholds, predictability pay, and rate settings.',
  },
  general: {
    label: 'General',
    description: 'Global system configuration.',
  },
};

// ─── Setting Row ─────────────────────────────────────────────────────────────

function SettingRow({
  setting,
  onEdit,
  onToggleEnabled,
}: {
  setting: SystemSetting;
  onEdit: (s: SystemSetting) => void;
  onToggleEnabled: (s: SystemSetting) => void;
}) {
  const valueType = typeof setting.value;

  function renderValue() {
    if (valueType === 'boolean') {
      return (
        <span className={`text-sm font-mono ${setting.isEnabled ? '' : 'opacity-40'}`}>
          {String(setting.value)}
        </span>
      );
    }
    return (
      <span className={`text-sm font-mono ${setting.isEnabled ? '' : 'opacity-40'}`}>
        {String(setting.value)}
      </span>
    );
  }

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 pr-4 w-64">
        <div className="flex items-center gap-2">
          <p className="text-sm font-mono text-foreground">{setting.key}</p>
          {!setting.isEnabled && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">Disabled</Badge>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground">
        {setting.description ?? <span className="italic opacity-50">No description</span>}
      </td>
      <td className="py-3 pr-4 text-right">
        {renderValue()}
      </td>
      <td className="py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(setting)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onToggleEnabled(setting)}
              className={setting.isEnabled ? 'text-destructive focus:text-destructive' : ''}
            >
              {setting.isEnabled ? (
                <>
                  <PowerOff className="h-3.5 w-3.5 mr-2" />
                  Disable
                </>
              ) : (
                <>
                  <Power className="h-3.5 w-3.5 mr-2" />
                  Enable
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function SettingsGroup({
  prefix,
  settings,
  onEdit,
  onToggleEnabled,
}: {
  prefix: string;
  settings: SystemSetting[];
  onEdit: (s: SystemSetting) => void;
  onToggleEnabled: (s: SystemSetting) => void;
}) {
  const meta = GROUP_META[prefix] ?? { label: prefix.charAt(0).toUpperCase() + prefix.slice(1), description: '' };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{meta.label}</CardTitle>
        {meta.description && <CardDescription>{meta.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key</th>
              <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</th>
              <th className="pb-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <SettingRow key={s.key} setting={s} onEdit={onEdit} onToggleEnabled={onToggleEnabled} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [editSetting, setEditSetting] = useState<SystemSetting | null>(null);
  const [editForm, setEditForm] = useState<{ value: string; description: string }>({
    value: '',
    description: '',
  });

  const isAdmin = user?.role === 'admin';

  const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, patch }: { key: string; patch: Parameters<typeof settingsApi.update>[1] }) =>
      settingsApi.update(key, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Setting updated');
      setEditSetting(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      settingsApi.update(key, { isEnabled }),
    onSuccess: (_, { isEnabled }) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(isEnabled ? 'Setting enabled' : 'Setting disabled');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: settingsApi.reset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('All settings reset to defaults');
      setResetOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function openEdit(s: SystemSetting) {
    setEditSetting(s);
    setEditForm({
      value: String(s.value),
      description: s.description ?? '',
    });
  }

  function handleToggleEnabled(s: SystemSetting) {
    toggleEnabledMutation.mutate({ key: s.key, isEnabled: !s.isEnabled });
  }

  function commitEdit() {
    if (!editSetting) return;
    const valueType = typeof editSetting.value;
    let parsed: unknown = editForm.value;
    if (valueType === 'number') parsed = Number(editForm.value);
    else if (valueType === 'boolean') parsed = editForm.value === 'true';
    updateMutation.mutate({
      key: editSetting.key,
      patch: {
        value: parsed,
        description: editForm.description || null,
      },
    });
  }

  // ── Access guard ─
  if (user === null) return null;
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-muted-foreground">
        <ShieldAlert className="h-10 w-10 opacity-40" />
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm mt-1">Only administrators can view and edit system settings.</p>
        </div>
      </div>
    );
  }

  const groups = groupSettings(settings);
  const orderedPrefixes = [
    ...['scheduling', 'payroll'].filter((p) => groups[p]),
    ...Object.keys(groups).filter((p) => p !== 'scheduling' && p !== 'payroll'),
  ];

  const valueType = editSetting ? typeof editSetting.value : 'string';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground text-sm">
            Configure scheduling rules, payroll thresholds, and global defaults.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={() => setResetOpen(true)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to defaults
        </Button>
      </div>

      {/* Settings groups */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-72 mt-1" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : settings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Sliders className="h-8 w-8 opacity-30" />
            <p className="text-sm">No system settings found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orderedPrefixes.map((prefix) => (
            <SettingsGroup
              key={prefix}
              prefix={prefix}
              settings={groups[prefix]}
              onEdit={openEdit}
              onToggleEnabled={handleToggleEnabled}
            />
          ))}
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={!!editSetting} onOpenChange={(open) => !open && setEditSetting(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Setting</SheetTitle>
            <SheetDescription>
              Update the value and description for{' '}
              <span className="font-mono text-foreground">{editSetting?.key}</span>.
            </SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label>Value</Label>
              {valueType === 'boolean' ? (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editForm.value === 'true'}
                    onCheckedChange={(checked) =>
                      setEditForm((f) => ({ ...f, value: String(checked) }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {editForm.value === 'true' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ) : (
                <Input
                  type={valueType === 'number' ? 'number' : 'text'}
                  value={editForm.value}
                  onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                  className="font-mono"
                />
              )}
            </div>

            <div className="grid gap-3">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this setting controls…"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={commitEdit}
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

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all settings to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite every system setting with its factory default value. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? 'Resetting…' : 'Yes, reset all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
