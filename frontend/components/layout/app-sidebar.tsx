'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  MapPin,
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  Settings,
  LogOut,
  Wrench,
  Zap,
  CalendarCheck,
  HandHelping,
  Umbrella,
  CalendarRange,
  BookText,
  UtensilsCrossed,
  CalendarClock,
  Home,
  Inbox,
  Building2,
  Store,
  TrendingUp,
  CircleUser,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  CheckSquare,
  BadgeCheck,
  Clock,
  LayoutTemplate,
  Sliders,
  Scale,
  Star,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { bookmarksApi, getErrorMessage } from '@/lib/api';
import { Bookmark as BookmarkType } from '@/lib/types';
import { cn } from '@/lib/utils';

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
};

export type NavGroup = {
  id: string;
  label?: string;
  railIcon: React.ComponentType<{ className?: string }>;
  railLabel: string;
  roles: string[];
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'main',
    railIcon: Home,
    railLabel: 'Home',
    roles: ['admin', 'manager', 'staff'],
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
      { href: '/schedule', label: 'Schedule', icon: CalendarDays, roles: ['admin', 'manager', 'staff'] },
      { href: '/my-schedule', label: 'My Schedule', icon: CalendarRange, roles: ['staff'] },
      { href: '/timesheets', label: 'Timesheets', icon: Clock, roles: ['admin', 'manager', 'staff'] },
      { href: '/messages', label: 'Messages', icon: MessageSquare, roles: ['admin', 'manager', 'staff'] },
      { href: '/checklists', label: 'Checklists', icon: CheckSquare, roles: ['admin', 'manager', 'staff'] },
      { href: '/certifications', label: 'Certifications', icon: BadgeCheck, roles: ['admin', 'manager', 'staff'] },
    ],
  },
  {
    id: 'requests',
    label: 'Requests',
    railIcon: Inbox,
    railLabel: 'Requests',
    roles: ['admin', 'manager', 'staff'],
    items: [
      { href: '/swap-requests', label: 'Swap & Drop', icon: ArrowLeftRight, roles: ['admin', 'manager', 'staff'] },
      { href: '/pickup', label: 'Open Shifts', icon: HandHelping, roles: ['staff'] },
      { href: '/time-off', label: 'Time Off', icon: Umbrella, roles: ['admin', 'manager', 'staff'] },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    railIcon: Building2,
    railLabel: 'Management',
    roles: ['admin', 'manager'],
    items: [
      { href: '/staff', label: 'Staff', icon: Users, roles: ['admin', 'manager'] },
      { href: '/locations', label: 'Locations', icon: MapPin, roles: ['admin'] },
      { href: '/skills', label: 'Skills', icon: Wrench, roles: ['admin'] },
      { href: '/schedule-templates', label: 'Templates', icon: LayoutTemplate, roles: ['admin', 'manager'] },
      { href: '/log-book', label: 'Log Book', icon: BookText, roles: ['admin', 'manager'] },
    ],
  },
  {
    id: 'venue',
    label: 'Venue',
    railIcon: Store,
    railLabel: 'Venue',
    roles: ['admin', 'manager'],
    items: [
      { href: '/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['admin', 'manager'] },
      { href: '/reservations', label: 'Reservations', icon: CalendarClock, roles: ['admin', 'manager'] },
      { href: '/shift-feedback', label: 'Shift Feedback', icon: Star, roles: ['admin', 'manager', 'staff'] },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    railIcon: TrendingUp,
    railLabel: 'Insights',
    roles: ['admin', 'manager'],
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'manager'] },
      { href: '/audit', label: 'Audit Log', icon: ClipboardList, roles: ['admin', 'manager'] },
      { href: '/fair-workweek', label: 'Fair Workweek', icon: Scale, roles: ['admin', 'manager'] },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    railIcon: CircleUser,
    railLabel: 'Account',
    roles: ['admin', 'manager', 'staff'],
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager', 'staff'] },
      { href: '/settings/availability', label: 'Availability', icon: CalendarCheck, roles: ['staff'] },
      { href: '/settings/system', label: 'System Settings', icon: Sliders, roles: ['admin'] },
    ],
  },
];


function detectActiveGroupId(pathname: string, groups: NavGroup[]): string {
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (
      group.items.some(
        (item) =>
          pathname === item.href ||
          (item.href !== '/settings' && pathname.startsWith(item.href + '/')),
      )
    ) {
      return group.id;
    }
  }
  return groups[0]?.id ?? 'main';
}

type AppSidebarProps = {
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  secondaryOpen: boolean;
};

export function AppSidebar({ selectedGroupId, onSelectGroup, secondaryOpen }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data: bookmarks = [] } = useQuery<BookmarkType[]>({
    queryKey: ['bookmarks'],
    queryFn: bookmarksApi.list,
    enabled: !!user,
  });

  const toggleBookmarkMutation = useMutation({
    mutationFn: ({ href, label }: { href: string; label: string }) => {
      const existing = bookmarks.find((b) => b.href === href);
      return existing ? bookmarksApi.remove(existing.id) : bookmarksApi.create({ href, label });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const userRole = user?.role ?? 'staff';
  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? 'U';

  const visibleGroups = NAV_GROUPS.filter(
    (g) =>
      g.roles.includes(userRole) && g.items.some((item) => item.roles.includes(userRole)),
  );

  const activeGroupId = detectActiveGroupId(pathname, visibleGroups);
  const displayGroup = visibleGroups.find((g) => g.id === selectedGroupId) ?? visibleGroups[0];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full">
        {/* Icon rail */}
        <div className="flex w-13 shrink-0 flex-col items-center border-r border-sidebar-border/60 bg-sidebar">
          {/* Logo icon — matches secondary panel header height */}
          <div className="flex h-14 w-full items-center justify-center border-b border-sidebar-border/60">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-lg blur-sm" />
              <div className="relative w-8 h-8 bg-white/15 border border-white/25 rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          {/* Group icons */}
          <div className="flex flex-col items-center gap-0.5 py-3 flex-1">
            {visibleGroups.map((group) => {
              const isActive = group.id === activeGroupId;
              const isSelected = group.id === selectedGroupId;
              return (
                <Tooltip key={group.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectGroup(group.id)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150',
                        isActive
                          ? 'bg-white/20 text-white'
                          : isSelected && secondaryOpen
                          ? 'bg-white/12 text-white'
                          : 'text-white/55 hover:bg-white/12 hover:text-white',
                      )}
                    >
                      <group.railIcon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {group.railLabel}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* User avatar */}
          <div className="flex h-14 w-full items-center justify-center border-t border-sidebar-border/60">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-white/55 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150"
                >
                  <LogOut className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 absolute transition-opacity" />
                  <Avatar className="h-7 w-7 group-hover:opacity-0 transition-opacity">
                    <AvatarFallback className="text-[0.625rem] font-semibold bg-white/20 text-white border border-white/30">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {user?.name} · Sign out
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Secondary panel */}
        <div
          className={cn(
            'overflow-hidden border-r border-sidebar-border/60 bg-sidebar transition-all duration-200 ease-in-out',
            secondaryOpen ? 'w-49' : 'w-0',
          )}
        >
          <div className="flex h-full w-49 flex-col">
            {/* App logo + name — aligned with icon rail header */}
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border/60 px-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 border border-white/25">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm tracking-tight leading-tight text-white">ShiftSync</span>
                <span className="text-xs text-white/60 truncate leading-tight">Coastal Eats</span>
              </div>
            </div>

            {/* Nav section */}
            <div className="flex flex-col flex-1 overflow-y-auto py-3">
              {displayGroup?.label && (
                <p className="px-4 mb-2 text-[0.625rem] font-semibold uppercase tracking-widest text-white/40">
                  {displayGroup.label}
                </p>
              )}
              <nav className="flex flex-col gap-0.5 px-2">
                {displayGroup?.items
                  .filter((item) => item.roles.includes(userRole))
                  .map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/settings' && pathname.startsWith(item.href + '/'));
                    const isBookmarked = bookmarks.some((b) => b.href === item.href);
                    return (
                      <div key={item.href} className="group/item relative">
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md pl-3 pr-8 h-8 text-sm font-medium transition-all duration-150 border-l-2',
                            isActive
                              ? 'border-white/60 bg-white/15 text-white'
                              : 'border-transparent text-white/60 hover:text-white hover:bg-white/10',
                          )}
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                        <button
                          onClick={() => toggleBookmarkMutation.mutate({ href: item.href, label: item.label })}
                          className={cn(
                            'absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded transition-all duration-150',
                            isBookmarked
                              ? 'text-white/70 hover:text-white'
                              : 'opacity-0 group-hover/item:opacity-100 text-white/40 hover:text-white/80',
                          )}
                        >
                          {isBookmarked
                            ? <BookmarkCheck className="h-3 w-3" />
                            : <Bookmark className="h-3 w-3" />}
                        </button>
                      </div>
                    );
                  })}
              </nav>
            </div>

            <div className="flex h-14 shrink-0 items-center border-t border-sidebar-border/60 px-4">
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight truncate text-white">{user?.name}</p>
                <p className="text-[0.625rem] capitalize leading-tight text-white/60">
                  {userRole}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
