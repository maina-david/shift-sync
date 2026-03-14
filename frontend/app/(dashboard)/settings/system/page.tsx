'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, Sliders, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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

// ─── Inline edit cell ────────────────────────────────────────────────────────

function SettingRow({ setting }: { setting: SystemSetting }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(setting.value));

  const mutation = useMutation({
    mutationFn: (value: unknown) => settingsApi.update(setting.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(`"${setting.key}" updated`);
      setEditing(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function commit(value: unknown) {
    if (String(value) === String(setting.value)) {
      setEditing(false);
      return;
    }
    mutation.mutate(value);
  }

  const valueType = typeof setting.value;

  function renderValueCell() {
    if (valueType === 'boolean') {
      return (
        <Switch
          checked={setting.value as boolean}
          onCheckedChange={(checked) => mutation.mutate(checked)}
          disabled={mutation.isPending}
        />
      );
    }

    if (editing) {
      return (
        <Input
          autoFocus
          type={valueType === 'number' ? 'number' : 'text'}
          className="h-7 w-40 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = valueType === 'number' ? Number(draft) : draft;
            commit(parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const parsed = valueType === 'number' ? Number(draft) : draft;
              commit(parsed);
            }
            if (e.key === 'Escape') {
              setDraft(String(setting.value));
              setEditing(false);
            }
          }}
          disabled={mutation.isPending}
        />
      );
    }

    return (
      <button
        className="rounded px-2 py-0.5 text-sm font-mono hover:bg-muted transition-colors cursor-text border border-transparent hover:border-border"
        onClick={() => {
          setDraft(String(setting.value));
          setEditing(true);
        }}
        title="Click to edit"
      >
        {String(setting.value)}
      </button>
    );
  }

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 pr-4 w-64">
        <p className="text-sm font-mono text-foreground">{setting.key}</p>
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground">
        {setting.description ?? <span className="italic opacity-50">No description</span>}
      </td>
      <td className="py-3 text-right">{renderValueCell()}</td>
    </tr>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function SettingsGroup({ prefix, settings }: { prefix: string; settings: SystemSetting[] }) {
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
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <SettingRow key={s.key} setting={s} />
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

  const isAdmin = user?.role === 'admin';

  const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
    enabled: isAdmin,
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

  // ── Access guard — wait for auth to settle before showing restricted message ─
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

  // Render groups in a stable order: scheduling → payroll → everything else
  const orderedPrefixes = [
    ...['scheduling', 'payroll'].filter((p) => groups[p]),
    ...Object.keys(groups).filter((p) => p !== 'scheduling' && p !== 'payroll'),
  ];

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
            <SettingsGroup key={prefix} prefix={prefix} settings={groups[prefix]} />
          ))}
        </div>
      )}

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
