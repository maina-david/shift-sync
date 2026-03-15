// ─── Domain Types ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'area_manager' | 'staff';
export type ShiftStatus = 'draft' | 'published';
export type AssignmentStatus = 'assigned' | 'pending_swap' | 'completed' | 'cancelled';
export type SwapRequestStatus = 'pending' | 'accepted' | 'rejected' | 'approved' | 'denied' | 'cancelled';
export type DropRequestStatus = 'open' | 'claimed' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

// Runtime-safe value sets (use for guards, validation, and switch exhaustiveness)
export const USER_ROLES: UserRole[] = ['admin', 'manager', 'area_manager', 'staff'];
export const SHIFT_STATUSES: ShiftStatus[] = ['draft', 'published'];
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['assigned', 'pending_swap', 'completed', 'cancelled'];
export const SWAP_REQUEST_STATUSES: SwapRequestStatus[] = ['pending', 'accepted', 'rejected', 'approved', 'denied', 'cancelled'];
export const DROP_REQUEST_STATUSES: DropRequestStatus[] = ['open', 'claimed', 'approved', 'rejected', 'expired', 'cancelled'];
export const TIME_OFF_STATUSES: TimeOffStatus[] = ['pending', 'approved', 'denied', 'cancelled'];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  desiredHoursPerWeek: number;
  hourlyRate: number | null;
  notificationPreferences: { inApp: boolean; email: boolean } | null;
  skills: Skill[];
  certifiedLocations: Location[];
  managedLocations: Location[];
  createdAt: string;
  updatedAt: string;
}

export interface FloorZoneConfig {
  id: string;
  label: string;
  position: [number, number];
  size: [number, number];
  skills: string[];
  colorLight: string;
  colorDark: string;
  colorSelectedLight: string;
  colorSelectedDark: string;
}

export interface Location {
  id: string;
  name: string;
  timezone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  zones: FloorZoneConfig[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  location: Location;
  locationId: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  requiredSkill: Skill | null;
  requiredSkillId: string | null;
  headcount: number;
  status: ShiftStatus;
  notes: string | null;
  isOvernight: boolean;
  assignments: ShiftAssignment[];
  publishedAt: string | null;
  publishedById: string | null;
  publishedBy?: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAssignment {
  id: string;
  shift: Shift;
  shiftId: string;
  staff: User;
  staffId: string;
  status: AssignmentStatus;
  assignedById: string | null;
  assignedBy?: User | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  id: string;
  userId: string;
  dayOfWeek: number;     // 0=Sun … 6=Sat
  startTime: string;
  endTime: string;
}

export interface AvailabilityException {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isUnavailable: boolean;
  createdAt: string;
}

export interface SwapRequest {
  id: string;
  fromAssignment: ShiftAssignment;
  fromAssignmentId: string;
  toUser: User;
  toUserId: string;
  status: SwapRequestStatus;
  reason: string | null;
  managerId: string | null;
  managerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DropRequest {
  id: string;
  assignment: ShiftAssignment;
  assignmentId: string;
  claimedBy: User | null;
  claimedById: string | null;
  status: DropRequestStatus;
  reason: string | null;
  managerId: string | null;
  managerNote: string | null;
  expiresAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface TimeOffRequest {
  id: string;
  staff: User;
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: TimeOffStatus;
  reviewedById: string | null;
  managerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  locationId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  performedBy: User | null;
  note: string | null;
  timestamp: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show';

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  tag: string | null;
  tagColor: 'cyan' | 'violet' | 'pink' | null;
  isAvailable: boolean;
  isTodaysHighlight: boolean;
  sortOrder: number;
  locationId: string | null;
  location: Location | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  label: string;
  href: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  customerName: string;
  email: string;
  phone: string | null;
  date: string;
  time: string;
  partySize: number;
  location: Location | null;
  locationId: string | null;
  status: ReservationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ConstraintViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintViolation[];
  alternatives: { id: string; name: string }[];
}

export interface HoursDistributionEntry {
  staffId: string;
  name: string;
  totalHours: number;
  desiredHoursPerWeek: number;
}

export interface FairnessEntry {
  staffId: string;
  name: string;
  totalShifts: number;
  premiumShifts: number;
  totalHours: number;
  premiumRatio: number;
}

export interface FairnessReport {
  fairnessScore: number | null;
  staff: FairnessEntry[];
}

export interface OvertimeEntry {
  staffId: string;
  name: string;
  hourlyRate: number | null;
  weeklyHours: number;
  overtimeHours: number;
  overtimeCost: number | null;
  isAtRisk: boolean;
  isOvertime: boolean;
  assignments: Array<{
    shiftId: string;
    date: string;
    startTime: string;
    endTime: string;
    minutes: number;
    isOvertimePusher: boolean;
    isInOvertime: boolean;
  }>;
}

// ─── Schedule Templates ───────────────────────────────────────────────────────
export interface TemplateShift {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredSkillId: string | null;
  headcount: number;
  notes: string | null;
}
export interface ScheduleTemplate {
  id: string;
  name: string;
  locationId: string;
  location: Location;
  shifts: TemplateShift[];
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Timesheets ───────────────────────────────────────────────────────────────
export type TimesheetStatus = 'pending' | 'approved' | 'rejected';
export interface Timesheet {
  id: string;
  staffId: string;
  staff: User;
  shiftId: string | null;
  shift: Shift | null;
  assignmentId: string | null;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  actualHours: number | null;
  status: TimesheetStatus;
  reviewedById: string | null;
  managerNote: string | null;
  reviewedAt: string | null;
  locationId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Certifications ───────────────────────────────────────────────────────────
export interface Certification {
  id: string;
  userId: string;
  name: string;
  issuedDate: string;
  expiryDate: string;
  documentUrl: string | null;
  issuer: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export type MessageType = 'direct' | 'announcement';
export interface Message {
  id: string;
  type: MessageType;
  senderId: string;
  sender: User;
  recipientId: string | null;
  recipient: User | null;
  locationId: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Checklists ───────────────────────────────────────────────────────────────
export type ChecklistType = 'opening' | 'closing' | 'custom';
export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completedAt: string | null;
  completedById: string | null;
}
export interface Checklist {
  id: string;
  type: ChecklistType;
  title: string;
  locationId: string;
  location: Location;
  shiftId: string | null;
  assignedToId: string | null;
  items: ChecklistItem[];
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Shift Feedback ───────────────────────────────────────────────────────────
export interface ShiftFeedback {
  id: string;
  staffId: string;
  assignmentId: string;
  assignment: ShiftAssignment;
  rating: number;
  comment: string | null;
  adequatelyStaffed: boolean | null;
  wouldRepeat: boolean | null;
  createdAt: string;
}
export interface FeedbackSummary {
  totalResponses: number;
  averageRating: number | null;
  pctAdequatelyStaffed: number | null;
  pctWouldRepeat: number | null;
}

// ─── Fair Workweek ────────────────────────────────────────────────────────────
export type ScheduleChangeType = 'published' | 'modified' | 'cancelled';
export interface ScheduleChangeLog {
  id: string;
  shiftId: string;
  shift: Shift;
  changeType: ScheduleChangeType;
  changedAt: string;
  hoursBeforeShift: number;
  triggersPredictabilityPay: boolean;
  predictabilityPayAmount: number | null;
  changedById: string | null;
  createdAt: string;
}

// ─── System Settings ─────────────────────────────────────────────────────────
export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  isEnabled: boolean;
  updatedAt: string;
}

// ─── Analytics Extensions ────────────────────────────────────────────────────
export interface LaborCostReport {
  totalScheduledHours: number;
  totalLaborCost: number;
  byLocation: { locationId: string; name: string; scheduledHours: number; laborCost: number; shiftCount: number }[];
  byDate: { date: string; laborCost: number; scheduledHours: number }[];
}
export interface KpiRollup {
  locationId: string;
  name: string;
  timezone: string;
  totalShifts: number;
  publishedShifts: number;
  draftShifts: number;
  totalAssignments: number;
  totalScheduledHours: number;
  estimatedLaborCost: number;
  fillRate: number;
}
export interface AbsenteeismReport {
  noShowCount: number;
  noShowRate: number;
  byStaff: { staffId: string; name: string; noShowCount: number }[];
  byDate: { date: string; noShowCount: number }[];
}
export interface TurnoverReport {
  totalActive: number;
  totalInactive: number;
  hiresByMonth: { month: string; count: number }[];
  activeByLocation: { locationId: string; name: string; staffCount: number }[];
}
