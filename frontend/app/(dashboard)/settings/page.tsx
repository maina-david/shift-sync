'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, User, Lock, Bell, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { usersApi, getErrorMessage } from '@/lib/api';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  desiredHoursPerWeek: z.coerce.number().min(0).max(168),
});

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

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(12, 'Password must be at least 12 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [inApp, setInApp] = useState(user?.notificationPreferences?.inApp ?? true);
  const [emailNotif, setEmailNotif] = useState(user?.notificationPreferences?.email ?? false);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      desiredHoursPerWeek: user?.desiredHoursPerWeek ?? 40,
    },
  });

  const [showNewPw, setShowNewPw] = useState(false);

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    reset: resetPassword,
    watch: watchPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const newPwValue = watchPassword('newPassword') ?? '';
  const pwStrength = passwordStrength(newPwValue);

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => usersApi.update(user!.id, data),
    onSuccess: () => {
      refreshUser();
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      usersApi.changePassword(user!.id, data.currentPassword, data.newPassword),
    onSuccess: () => {
      resetPassword();
      toast.success('Password changed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const notifMutation = useMutation({
    mutationFn: (prefs: { inApp: boolean; email: boolean }) =>
      usersApi.update(user!.id, { notificationPreferences: prefs }),
    onSuccess: () => toast.success('Notification preferences saved'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-2">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-3.5 w-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Lock className="h-3.5 w-3.5" /> Password
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleProfile((d) => profileMutation.mutate(d))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input {...regProfile('name')} placeholder="Jane Smith" />
                  {profileErrors.name && (
                    <p className="text-xs text-destructive">{profileErrors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...regProfile('email')} type="email" placeholder="jane@example.com" />
                  {profileErrors.email && (
                    <p className="text-xs text-destructive">{profileErrors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Desired hours / week</Label>
                  <Input
                    {...regProfile('desiredHoursPerWeek')}
                    type="number"
                    min={0}
                    max={168}
                    className="w-24"
                  />
                  {profileErrors.desiredHoursPerWeek && (
                    <p className="text-xs text-destructive">{profileErrors.desiredHoursPerWeek.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={profileMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {profileMutation.isPending ? 'Saving…' : 'Save profile'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handlePassword((d) => passwordMutation.mutate(d))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current password</Label>
                  <Input {...regPassword('currentPassword')} type="password" autoComplete="current-password" />
                  {passwordErrors.currentPassword && (
                    <p className="text-xs text-destructive">{passwordErrors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>New password</Label>
                  <div className="relative">
                    <Input {...regPassword('newPassword')} type={showNewPw ? 'text' : 'password'} autoComplete="new-password" className="pr-9" />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPwValue && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= pwStrength.score ? pwStrength.color : 'bg-muted'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{pwStrength.label}</p>
                    </div>
                  )}
                  {passwordErrors.newPassword && (
                    <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Confirm new password</Label>
                  <Input {...regPassword('confirmPassword')} type="password" autoComplete="new-password" />
                  {passwordErrors.confirmPassword && (
                    <p className="text-xs text-destructive">{passwordErrors.confirmPassword.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? 'Updating…' : 'Change password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">In-app notifications</p>
                  <p className="text-xs text-muted-foreground">Show alerts inside ShiftSync</p>
                </div>
                <Switch checked={inApp} onCheckedChange={setInApp} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email notifications</p>
                  <p className="text-xs text-muted-foreground">Receive shift updates via email</p>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
              </div>
              <Button
                size="sm"
                onClick={() => notifMutation.mutate({ inApp, email: emailNotif })}
                disabled={notifMutation.isPending}
              >
                {notifMutation.isPending ? 'Saving…' : 'Save preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
