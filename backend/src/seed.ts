import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

import { User, UserRole } from './users/entities/user.entity';
import { Location, DEFAULT_FLOOR_ZONES } from './locations/entities/location.entity';
import { Skill } from './skills/entities/skill.entity';
import { Shift, ShiftStatus } from './shifts/entities/shift.entity';
import { ShiftAssignment, AssignmentStatus } from './shifts/entities/shift-assignment.entity';
import { Availability } from './users/entities/availability.entity';
import { AvailabilityException } from './users/entities/availability-exception.entity';
import { SwapRequest, SwapRequestStatus } from './swap-requests/entities/swap-request.entity';
import { DropRequest, DropRequestStatus } from './drop-requests/entities/drop-request.entity';
import { Notification } from './notifications/entities/notification.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { TimeOffRequest, TimeOffStatus } from './time-off-requests/entities/time-off-request.entity';
import { LogEntry } from './log-book/entities/log-entry.entity';
import { MenuItem } from './menu/entities/menu-item.entity';
import { Reservation, ReservationStatus } from './reservations/entities/reservation.entity';
import { Bookmark } from './bookmarks/entities/bookmark.entity';
import { ScheduleTemplate } from './schedule-templates/entities/schedule-template.entity';
import { Timesheet, TimesheetStatus } from './timesheets/entities/timesheet.entity';
import { Certification } from './certifications/entities/certification.entity';
import { Message, MessageType } from './messages/entities/message.entity';
import { Checklist, ChecklistType } from './checklists/entities/checklist.entity';
import { ShiftFeedback } from './shift-feedback/entities/shift-feedback.entity';
import { ScheduleChangeLog, ChangeType } from './fair-workweek/entities/schedule-change-log.entity';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

function getThisMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function main() {
  console.log('🌱 ShiftSync Seed — connecting...');

  const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'shift_sync',
    entities: [
      User, Location, Skill, Shift, ShiftAssignment,
      Availability, AvailabilityException,
      SwapRequest, DropRequest, Notification, AuditLog,
      TimeOffRequest, LogEntry,
      MenuItem, Reservation, Bookmark,
      ScheduleTemplate, Timesheet, Certification,
      Message, Checklist, ShiftFeedback, ScheduleChangeLog,
    ],
    synchronize: true,
  });

  await AppDataSource.initialize();
  console.log('✅ Connected to MySQL\n');

  console.log('🗑️  Clearing existing data...');
  await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'audit_logs', 'notifications', 'drop_requests', 'swap_requests',
    'availability_exceptions', 'availabilities',
    'shift_assignments', 'shifts',
    'user_skills', 'user_location_certifications', 'manager_location_assignments',
    'users', 'skills', 'locations',
    'time_off_requests', 'log_entries',
    'menu_items', 'reservations', 'bookmarks',
    'schedule_templates', 'timesheets', 'certifications',
    'messages', 'checklists', 'shift_feedback', 'schedule_change_logs',
  ];
  for (const table of tables) {
    await AppDataSource.query(`TRUNCATE TABLE \`${table}\``);
  }
  await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('✅ Tables cleared\n');

  const userRepo      = AppDataSource.getRepository(User);
  const locationRepo  = AppDataSource.getRepository(Location);
  const skillRepo     = AppDataSource.getRepository(Skill);
  const shiftRepo     = AppDataSource.getRepository(Shift);
  const assignRepo    = AppDataSource.getRepository(ShiftAssignment);
  const availRepo     = AppDataSource.getRepository(Availability);
  const exceptRepo    = AppDataSource.getRepository(AvailabilityException);
  const swapRepo      = AppDataSource.getRepository(SwapRequest);
  const dropRepo      = AppDataSource.getRepository(DropRequest);
  const notifRepo     = AppDataSource.getRepository(Notification);
  const auditRepo     = AppDataSource.getRepository(AuditLog);
  const timeOffRepo   = AppDataSource.getRepository(TimeOffRequest);
  const logRepo       = AppDataSource.getRepository(LogEntry);
  const menuRepo      = AppDataSource.getRepository(MenuItem);
  const reservRepo    = AppDataSource.getRepository(Reservation);
  const bookmarkRepo  = AppDataSource.getRepository(Bookmark);
  const templateRepo  = AppDataSource.getRepository(ScheduleTemplate);
  const timesheetRepo = AppDataSource.getRepository(Timesheet);
  const certRepo      = AppDataSource.getRepository(Certification);
  const messageRepo   = AppDataSource.getRepository(Message);
  const checklistRepo = AppDataSource.getRepository(Checklist);
  const feedbackRepo  = AppDataSource.getRepository(ShiftFeedback);
  const changeLogRepo = AppDataSource.getRepository(ScheduleChangeLog);

  const thisMonday = getThisMonday();
  const lastMonday = addDays(thisMonday, -7);
  const nextMonday = addDays(thisMonday, 7);

  // lw/tw/nw = last/this/next week offset from Monday
  const lw = (n: number) => fmt(addDays(lastMonday, n));
  const tw = (n: number) => fmt(addDays(thisMonday, n));
  const nw = (n: number) => fmt(addDays(nextMonday, n));

  console.log(`📅 This week: ${tw(0)} (Mon) → ${tw(6)} (Sun)\n`);

  console.log('📍 Creating locations...');
  const [loc1, loc2, loc3, loc4] = await locationRepo.save([
    locationRepo.create({ name: 'North Beach',     timezone: 'America/New_York',    address: '123 North Beach Ave, New York, NY 10001',          zones: DEFAULT_FLOOR_ZONES }),
    locationRepo.create({ name: 'Midtown East',    timezone: 'America/New_York',    address: '456 Park Ave, New York, NY 10022',                  zones: DEFAULT_FLOOR_ZONES }),
    locationRepo.create({ name: 'Marina District', timezone: 'America/Los_Angeles', address: '789 Marina Blvd, San Francisco, CA 94123',          zones: DEFAULT_FLOOR_ZONES }),
    locationRepo.create({ name: 'Santa Monica',    timezone: 'America/Los_Angeles', address: '321 Ocean Ave, Santa Monica, CA 90401',             zones: DEFAULT_FLOOR_ZONES }),
  ]);
  console.log('  ✓ 4 locations (2 ET, 2 PT)\n');

  console.log('🎯 Creating skills...');
  const [sServer, sBartender, sLineCook, sHost, sBarback, sShiftLead] = await skillRepo.save([
    skillRepo.create({ name: 'Server',       description: 'Table service, order taking, POS system proficiency' }),
    skillRepo.create({ name: 'Bartender',    description: 'Cocktail preparation, liquor licensing, responsible service' }),
    skillRepo.create({ name: 'Line Cook',    description: 'Kitchen line operations, food safety certification required' }),
    skillRepo.create({ name: 'Host/Hostess', description: 'Guest reception, reservation management, seating coordination' }),
    skillRepo.create({ name: 'Barback',      description: 'Bar support, inventory restocking, glassware management' }),
    skillRepo.create({ name: 'Shift Lead',   description: 'Team supervision, cash drawer, opening/closing procedures' }),
  ]);
  console.log('  ✓ 6 skills\n');

  console.log('👥 Creating users...');
  const pw = await bcrypt.hash('Coastal2024!', 12);

  const [
    uAdmin, uMarcus, uPriya,
    uAlice, uBob, uCarol, uDave, uEmma, uFrank, uGrace, uHenry,
  ] = await userRepo.save([
    userRepo.create({
      name: 'Sarah Chen', email: 'admin@coastal.com', password: pw,
      role: UserRole.ADMIN, isActive: true, desiredHoursPerWeek: 40,
      notificationPreferences: { inApp: true, email: true },
      certifiedLocations: [loc1, loc2, loc3, loc4], managedLocations: [],
      skills: [sShiftLead],
    }),
    userRepo.create({
      name: 'Marcus Johnson', email: 'marcus@coastal.com', password: pw,
      role: UserRole.MANAGER, isActive: true, desiredHoursPerWeek: 40,
      notificationPreferences: { inApp: true, email: false },
      certifiedLocations: [loc1, loc2], managedLocations: [loc1, loc2],
      skills: [sShiftLead, sServer],
    }),
    userRepo.create({
      name: 'Priya Patel', email: 'priya@coastal.com', password: pw,
      role: UserRole.MANAGER, isActive: true, desiredHoursPerWeek: 40,
      notificationPreferences: { inApp: true, email: true },
      certifiedLocations: [loc3, loc4], managedLocations: [loc3, loc4],
      skills: [sShiftLead, sHost],
    }),
    userRepo.create({
      name: 'Alice Thompson', email: 'alice@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 40,
      notificationPreferences: { inApp: true, email: false },
      certifiedLocations: [loc1, loc2], skills: [sServer, sHost],
    }),
    userRepo.create({
      name: 'Bob Martinez', email: 'bob@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 30,
      notificationPreferences: { inApp: true, email: false },
      certifiedLocations: [loc1], skills: [sBartender, sBarback],
    }),
    userRepo.create({
      name: 'Carol Williams', email: 'carol@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 40,
      notificationPreferences: { inApp: true, email: true },
      certifiedLocations: [loc1, loc2, loc3, loc4], skills: [sLineCook, sShiftLead, sServer],
    }),
    userRepo.create({
      name: 'Dave Park', email: 'dave@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 35,
      notificationPreferences: { inApp: true, email: false },
      certifiedLocations: [loc2, loc3], skills: [sServer, sBartender],
    }),
    userRepo.create({
      name: 'Emma Rodriguez', email: 'emma@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 25,
      notificationPreferences: { inApp: true, email: false },
      certifiedLocations: [loc3, loc4], skills: [sHost, sServer],
    }),
    userRepo.create({
      name: 'Frank Chen', email: 'frank@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 20,
      notificationPreferences: { inApp: false, email: false },
      certifiedLocations: [loc4], skills: [sLineCook],
    }),
    userRepo.create({
      name: 'Grace Kim', email: 'grace@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 40,
      notificationPreferences: { inApp: true, email: true },
      certifiedLocations: [loc1, loc2, loc3, loc4], skills: [sBartender, sShiftLead, sServer],
    }),
    userRepo.create({
      name: 'Henry Wilson', email: 'henry@coastal.com', password: pw,
      role: UserRole.STAFF, isActive: true, desiredHoursPerWeek: 16,
      notificationPreferences: { inApp: true, email: false },
      certifiedLocations: [loc1], skills: [sServer, sHost],
    }),
  ]);
  console.log('  ✓ 11 users (1 admin, 2 managers, 8 staff)\n');

  console.log('📅 Setting weekly availability...');
  const avail = (user: User, day: number, start: string, end: string) =>
    availRepo.create({ user, dayOfWeek: day, startTime: start, endTime: end });

  await availRepo.save([
    ...[1,2,3,4,5].map(d => avail(uAlice, d, '08:00', '20:00')),
    ...[2,3,4,5,6].map(d => avail(uBob, d, '12:00', '23:00')),
    ...[0,1,2,3,4,5,6].map(d => avail(uCarol, d, '07:00', '16:00')),
    ...[1,2,3,4,5].map(d => avail(uDave, d, '15:00', '23:00')),
    ...[3,4,5,6,0].map(d => avail(uEmma, d, '10:00', '22:00')),
    ...[5,6,0].map(d => avail(uFrank, d, '14:00', '23:00')),
    ...[1,2,3,4,5,6].map(d => avail(uGrace, d, '08:00', '20:00')),
    ...[1,2,3].map(d => avail(uHenry, d, '09:00', '17:00')),
  ]);
  console.log('  ✓ Availability slots set\n');

  console.log('🚫 Setting availability exceptions...');
  await exceptRepo.save([
    exceptRepo.create({ user: uAlice, date: nw(0), isUnavailable: true }),
    exceptRepo.create({ user: uHenry, date: tw(5), startTime: '10:00', endTime: '16:00', isUnavailable: false }),
    exceptRepo.create({ user: uDave,  date: tw(2), startTime: '18:00', endTime: '23:00', isUnavailable: false }),
  ]);
  console.log('  ✓ 3 exceptions (Alice next Mon, Henry this Sat, Dave this Wed)\n');

  console.log('📋 Creating shifts...');

  const shift = (
    loc: Location, date: string, start: string, end: string,
    skill: Skill | null, headcount = 1,
    status = ShiftStatus.PUBLISHED,
    notes: string | null = null,
  ) => shiftRepo.create({
    location: loc, date, startTime: start, endTime: end,
    requiredSkill: skill, headcount, status, notes,
    isOvernight: end < start,
    publishedAt: status === ShiftStatus.PUBLISHED ? new Date() : null,
    publishedById: status === ShiftStatus.PUBLISHED ? uMarcus.id : null,
  });

  const lwShifts = await shiftRepo.save([
    shift(loc1, lw(0), '09:00', '17:00', sServer, 2),
    shift(loc1, lw(0), '17:00', '23:00', sBartender),
    shift(loc1, lw(1), '09:00', '17:00', sServer),
    shift(loc1, lw(1), '17:00', '23:00', sBartender),
    shift(loc1, lw(2), '09:00', '17:00', sServer),
    shift(loc1, lw(2), '17:00', '23:00', sBartender),
    shift(loc1, lw(3), '09:00', '17:00', sServer),
    shift(loc1, lw(3), '17:00', '23:00', sBartender),
    shift(loc1, lw(4), '09:00', '17:00', sServer),
    shift(loc1, lw(4), '17:00', '23:00', sBartender, 1, ShiftStatus.PUBLISHED, 'Premium Fri evening'),
    shift(loc1, lw(5), '18:00', '23:00', sBartender, 1, ShiftStatus.PUBLISHED, 'Premium Sat evening'),
    shift(loc2, lw(0), '17:00', '23:00', sServer),
    shift(loc2, lw(1), '17:00', '23:00', sServer),
    shift(loc2, lw(2), '17:00', '23:00', sServer),
    shift(loc2, lw(3), '17:00', '23:00', sServer),
    shift(loc2, lw(4), '17:00', '23:00', sServer),
    shift(loc2, lw(5), '18:00', '23:00', sShiftLead),
    shift(loc2, lw(6), '11:00', '19:00', sServer),
    shift(loc3, lw(2), '10:00', '18:00', sHost),
    shift(loc3, lw(3), '10:00', '18:00', sHost),
    shift(loc3, lw(4), '16:00', '22:00', sHost, 1, ShiftStatus.PUBLISHED, 'Premium Fri evening'),
    shift(loc3, lw(5), '11:00', '19:00', sServer),
    shift(loc4, lw(4), '14:00', '22:00', sLineCook),
    shift(loc4, lw(5), '14:00', '22:00', sLineCook),
    shift(loc4, lw(6), '12:00', '20:00', sLineCook),
  ]);

  const nbMon1   = shift(loc1, tw(0), '09:00', '17:00', sServer, 2);
  const nbMon2   = shift(loc1, tw(0), '17:00', '23:00', sBartender);
  const nbTue1   = shift(loc1, tw(1), '09:00', '17:00', sServer);
  const nbTue2   = shift(loc1, tw(1), '17:00', '23:00', sBartender);
  const nbWed1   = shift(loc1, tw(2), '09:00', '17:00', sServer);
  const nbWed2   = shift(loc1, tw(2), '17:00', '23:00', sBartender);
  const nbThu1   = shift(loc1, tw(3), '09:00', '17:00', sServer);
  const nbThu2   = shift(loc1, tw(3), '17:00', '23:00', sBartender);
  const nbFri1   = shift(loc1, tw(4), '09:00', '17:00', sServer);
  const nbFri2   = shift(loc1, tw(4), '17:00', '23:00', sBartender, 1, ShiftStatus.PUBLISHED, 'Premium Fri evening');
  const nbSat1   = shift(loc1, tw(5), '11:00', '19:00', sServer, 1, ShiftStatus.DRAFT);
  const nbSat2   = shift(loc1, tw(5), '18:00', '23:00', sBartender, 1, ShiftStatus.PUBLISHED, 'Premium Sat evening');
  const nbSatON  = shiftRepo.create({
    location: loc1, date: tw(5), startTime: '22:00', endTime: '04:00',
    requiredSkill: sBartender, headcount: 1, status: ShiftStatus.DRAFT,
    isOvernight: true, notes: 'Late-night closing shift — crosses midnight',
    publishedAt: null, publishedById: null,
  });
  const nbSun1   = shift(loc1, tw(6), '10:00', '18:00', sServer, 1, ShiftStatus.DRAFT);

  const meMon    = shift(loc2, tw(0), '17:00', '23:00', sServer);
  const meTue    = shift(loc2, tw(1), '17:00', '23:00', sServer);
  const meWed    = shift(loc2, tw(2), '18:00', '23:00', sServer, 1, ShiftStatus.PUBLISHED, 'Dave available from 18:00 only (appointment)');
  const meThu    = shift(loc2, tw(3), '17:00', '23:00', sServer, 2);
  const meFri    = shift(loc2, tw(4), '17:00', '23:00', sServer, 1, ShiftStatus.PUBLISHED, 'Friday rush — pickup available, contact Marcus');
  const meSat    = shift(loc2, tw(5), '18:00', '23:00', sShiftLead, 1, ShiftStatus.DRAFT);

  const mdTue    = shift(loc3, tw(1), '10:00', '18:00', sHost);
  const mdWed    = shift(loc3, tw(2), '10:00', '18:00', sHost);
  const mdThu    = shift(loc3, tw(3), '10:00', '18:00', sHost);
  const mdFri    = shift(loc3, tw(4), '16:00', '22:00', sHost, 1, ShiftStatus.PUBLISHED, 'Premium Friday evening — expect full house');
  const mdSat    = shift(loc3, tw(5), '11:00', '19:00', sServer);
  const mdSatBar = shift(loc3, tw(5), '19:00', '23:00', sBartender, 1, ShiftStatus.DRAFT);

  const smFri    = shift(loc4, tw(4), '14:00', '22:00', sLineCook);
  const smSat    = shift(loc4, tw(5), '14:00', '22:00', sLineCook, 1, ShiftStatus.PUBLISHED, "Frank's shift — coverage pending manager approval");
  const smSun    = shift(loc4, tw(6), '14:00', '22:00', sLineCook, 1, ShiftStatus.DRAFT);

  await shiftRepo.save([
    nbMon1, nbMon2, nbTue1, nbTue2, nbWed1, nbWed2, nbThu1, nbThu2,
    nbFri1, nbFri2, nbSat1, nbSat2, nbSatON, nbSun1,
    meMon, meTue, meWed, meThu, meFri, meSat,
    mdTue, mdWed, mdThu, mdFri, mdSat, mdSatBar,
    smFri, smSat, smSun,
  ]);

  await shiftRepo.save([
    shift(loc1, nw(0), '09:00', '17:00', sServer, 2, ShiftStatus.DRAFT),
    shift(loc1, nw(0), '17:00', '23:00', sBartender, 1, ShiftStatus.DRAFT),
    shift(loc1, nw(1), '09:00', '17:00', sServer, 1, ShiftStatus.DRAFT),
    shift(loc1, nw(4), '17:00', '23:00', sBartender, 1, ShiftStatus.DRAFT),
    shift(loc1, nw(5), '18:00', '23:00', sBartender, 1, ShiftStatus.DRAFT, 'Premium Sat evening'),
    shift(loc2, nw(0), '17:00', '23:00', sServer, 1, ShiftStatus.DRAFT),
    shift(loc2, nw(4), '17:00', '23:00', sServer, 1, ShiftStatus.DRAFT),
    shift(loc3, nw(1), '10:00', '18:00', sHost, 1, ShiftStatus.DRAFT),
    shift(loc3, nw(4), '16:00', '22:00', sHost, 1, ShiftStatus.DRAFT),
    shift(loc4, nw(4), '14:00', '22:00', sLineCook, 1, ShiftStatus.DRAFT),
    shift(loc4, nw(5), '14:00', '22:00', sLineCook, 1, ShiftStatus.DRAFT),
  ]);

  console.log('  ✓ Shifts created (last week + this week + next week drafts)\n');

  console.log('🗺️  Creating floor plan live-demo shifts (today, all-day)...');
  const today = fmt(new Date());
  const fpShifts = await shiftRepo.save([
    shift(loc1, today, '00:00', '23:59', sServer,    1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
    shift(loc1, today, '00:00', '23:59', sBartender, 1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
    shift(loc1, today, '00:00', '23:59', sShiftLead, 1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
    shift(loc1, today, '00:00', '23:59', sHost,      1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
    shift(loc2, today, '00:00', '23:59', sServer,    1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
    shift(loc3, today, '00:00', '23:59', sHost,      1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
    shift(loc4, today, '00:00', '23:59', sLineCook,  1, ShiftStatus.PUBLISHED, 'Floor plan demo'),
  ]);
  console.log('  ✓ Floor plan demo shifts created\n');

  console.log('👤 Creating assignments...');

  const confirmedAt = new Date();
  confirmedAt.setDate(confirmedAt.getDate() - 1);

  const assign = (s: Shift, staff: User, status = AssignmentStatus.ASSIGNED, isConfirmed = false) =>
    assignRepo.create({
      shift: s, staff, status, assignedById: uMarcus.id,
      confirmedAt: isConfirmed ? confirmedAt : null,
    });

  const lwAssignments = await assignRepo.save([
    assign(lwShifts[0], uAlice), assign(lwShifts[0], uHenry),
    assign(lwShifts[1], uBob),
    assign(lwShifts[2], uAlice), assign(lwShifts[3], uBob),
    assign(lwShifts[4], uAlice), assign(lwShifts[5], uBob),
    assign(lwShifts[6], uAlice), assign(lwShifts[7], uBob),
    assign(lwShifts[8], uAlice),
    assign(lwShifts[9], uGrace),
    assign(lwShifts[10], uGrace),
    assign(lwShifts[11], uDave), assign(lwShifts[12], uDave),
    assign(lwShifts[13], uDave), assign(lwShifts[14], uDave),
    assign(lwShifts[15], uDave),
    assign(lwShifts[16], uCarol),
    assign(lwShifts[17], uCarol),
    assign(lwShifts[18], uEmma), assign(lwShifts[19], uEmma),
    assign(lwShifts[20], uEmma),
    assign(lwShifts[21], uEmma),
    assign(lwShifts[22], uFrank),
    assign(lwShifts[23], uFrank),
    assign(lwShifts[24], uFrank),
  ]);

  const aNbMon1Alice  = await assignRepo.save(assign(nbMon1, uAlice, AssignmentStatus.ASSIGNED, true));
  const aNbMon1Henry  = await assignRepo.save(assign(nbMon1, uHenry, AssignmentStatus.ASSIGNED, true));
  const aNbMon2Bob    = await assignRepo.save(assign(nbMon2, uBob,   AssignmentStatus.ASSIGNED, true));
  const aNbTue1Alice  = await assignRepo.save(assign(nbTue1, uAlice, AssignmentStatus.ASSIGNED, true));
  const aNbTue2Bob    = await assignRepo.save(assign(nbTue2, uBob,   AssignmentStatus.ASSIGNED, true));
  const aNbWed1Alice  = await assignRepo.save(assign(nbWed1, uAlice));
  const aNbWed2Bob    = await assignRepo.save(assign(nbWed2, uBob));
  const aNbThu1Alice  = await assignRepo.save(assign(nbThu1, uAlice, AssignmentStatus.PENDING_SWAP));
  const aNbThu2Bob    = await assignRepo.save(assign(nbThu2, uBob,   AssignmentStatus.PENDING_SWAP));
  const aNbFri1Alice  = await assignRepo.save(assign(nbFri1, uAlice));
  const aNbFri2Grace  = await assignRepo.save(assign(nbFri2, uGrace));
  const aNbSat2Grace  = await assignRepo.save(assign(nbSat2, uGrace));

  const aMeMon       = await assignRepo.save(assign(meMon, uDave));
  const aMeTue       = await assignRepo.save(assign(meTue, uDave));
  const aMeWed       = await assignRepo.save(assign(meWed, uDave));
  const aMeThu1      = await assignRepo.save(assign(meThu, uDave));
  const aMeThu2Carol = await assignRepo.save(assign(meThu, uCarol));

  const aMdTue       = await assignRepo.save(assign(mdTue, uEmma));
  const aMdWed       = await assignRepo.save(assign(mdWed, uEmma));
  const aMdThu       = await assignRepo.save(assign(mdThu, uEmma));
  const aMdFri       = await assignRepo.save(assign(mdFri, uEmma));
  const aMdSat       = await assignRepo.save(assign(mdSat, uEmma));

  const aSmFri       = await assignRepo.save(assign(smFri, uFrank));
  const aSmSat       = await assignRepo.save(assign(smSat, uFrank));

  await assignRepo.save([
    assign(fpShifts[0], uMarcus),
    assign(fpShifts[1], uBob),
    assign(fpShifts[2], uCarol),
    assign(fpShifts[3], uHenry),
    assign(fpShifts[4], uDave),
    assign(fpShifts[5], uPriya),
    assign(fpShifts[6], uCarol),
  ]);
  console.log('  ✓ Floor plan demo assignments created\n');

  console.log('  ✓ Assignments created\n');

  console.log('🔄 Creating swap requests...');

  const swap1 = await swapRepo.save(swapRepo.create({
    fromAssignment: aNbThu1Alice, fromAssignmentId: aNbThu1Alice.id,
    toUser: uHenry, toUserId: uHenry.id,
    reason: 'I have a family obligation Thursday morning I forgot about.',
    status: SwapRequestStatus.ACCEPTED,
  }));

  const swap2 = await swapRepo.save(swapRepo.create({
    fromAssignment: aNbThu2Bob, fromAssignmentId: aNbThu2Bob.id,
    toUser: uGrace, toUserId: uGrace.id,
    reason: 'Dentist appointment in the afternoon, can Grace cover the evening?',
    status: SwapRequestStatus.PENDING,
  }));

  const swap3 = await swapRepo.save(swapRepo.create({
    fromAssignment: aMeMon, fromAssignmentId: aMeMon.id,
    toUser: uCarol, toUserId: uCarol.id,
    reason: 'Needed Monday off for a personal appointment.',
    status: SwapRequestStatus.DENIED,
    managerNote: 'Short-staffed that day — cannot approve this swap.',
    managerId: uMarcus.id,
  }));

  console.log('  ✓ 3 swap requests (accepted/pending approval, pending, denied)\n');

  console.log('📤 Creating drop requests...');

  const satStart = new Date(`${tw(5)}T22:00:00.000Z`);
  const expiresAt = new Date(satStart.getTime() - 24 * 60 * 60 * 1000);

  const drop1 = await dropRepo.save(dropRepo.create({
    assignment: aSmSat, assignmentId: aSmSat.id,
    claimedBy: uCarol, claimedById: uCarol.id,
    reason: 'Family emergency — need to travel out of town this weekend.',
    status: DropRequestStatus.CLAIMED,
    expiresAt,
  }));

  console.log("  ✓ 1 drop request (Frank's Sat — claimed by Carol, awaiting Priya)\n");

  console.log('🔔 Creating notifications...');

  const notif = (user: User, type: string, title: string, message: string,
    entityType: string | null, entityId: string | null, isRead = false) =>
    notifRepo.create({ user, userId: user.id, type, title, message, entityType, entityId, isRead });

  await notifRepo.save([
    notif(uAlice,  'SWAP_REQUEST_ACCEPTED', 'Swap Accepted',
      'Henry Wilson accepted your swap for Thursday morning at North Beach. Awaiting manager approval.',
      'swap_request', swap1.id),
    notif(uMarcus, 'SWAP_REQUEST_ACCEPTED', 'Swap Needs Your Approval',
      'Alice Thompson & Henry Wilson agreed to swap Thursday 09:00–17:00 at North Beach. Please review.',
      'swap_request', swap1.id),
    notif(uGrace,  'SWAP_REQUEST_RECEIVED', 'Swap Request Received',
      'Bob Martinez wants you to cover his Thursday bartender shift (17:00–23:00) at North Beach.',
      'swap_request', swap2.id),
    notif(uPriya,  'DROP_REQUEST_CLAIMED', 'Drop Request Needs Approval',
      'Carol Williams claimed Frank Chen\'s Saturday shift at Santa Monica (14:00–22:00). Please approve.',
      'drop_request', drop1.id),
    notif(uCarol,  'DROP_REQUEST_CLAIMED', 'Shift Claim Submitted',
      'Your claim for Frank\'s Saturday Santa Monica shift has been sent to Priya for approval.',
      'drop_request', drop1.id, true),
    notif(uFrank,  'DROP_REQUEST_CLAIMED', 'Your Shift Has Been Claimed',
      'Carol Williams has offered to cover your Saturday shift. Waiting for manager approval.',
      'drop_request', drop1.id, true),
    notif(uAlice,  'OVERTIME_WARNING', '⚠️ Overtime Reached',
      'You have reached 40 hours this week (Mon–Fri). Your Friday morning shift has pushed you into overtime.',
      'shift', nbFri1.id),
    notif(uMarcus, 'OVERTIME_WARNING', 'Staff Overtime Alert — Alice Thompson',
      'Alice Thompson has reached 40 hours this week. Review her schedule and consider reassigning future shifts.',
      'shift_assignment', aNbFri1Alice.id),
    notif(uEmma,   'SHIFT_ASSIGNED', '⚠️ 6 Consecutive Days',
      'You are scheduled for 6 consecutive days this week (Tue–Sun) at Marina District. Please confirm this is correct.',
      'shift_assignment', aMdSat.id),
    notif(uGrace,  'SHIFT_ASSIGNED', '⚠️ 6 Consecutive Days',
      'You are scheduled Mon–Sat this week (6 consecutive days). Ensure adequate rest between shifts.',
      'shift_assignment', aNbSat2Grace.id),
    notif(uHenry,  'SWAP_REQUEST_RECEIVED', 'You Accepted a Swap',
      'You accepted Alice\'s Thursday morning shift at North Beach (09:00–17:00). Awaiting manager sign-off.',
      'swap_request', swap1.id, true),
    notif(uMarcus, 'SCHEDULE_PUBLISHED', 'Schedule Published',
      `This week's schedule (${tw(0)}–${tw(6)}) has been published for North Beach and Midtown East.`,
      'shift', nbMon1.id, true),
    notif(uDave,   'SWAP_REQUEST_DENIED', 'Swap Denied',
      'Your swap request for Monday at Midtown East was denied by Marcus Johnson: "Short-staffed that day."',
      'swap_request', swap3.id, true),
    notif(uCarol,  'SHIFT_ASSIGNED', 'Override Assignment',
      'You were assigned Thursday at Midtown East as a 7th consecutive day (approved override). Please monitor fatigue.',
      'shift_assignment', aMeThu2Carol.id, true),
  ]);
  console.log('  ✓ 14 notifications seeded\n');

  console.log('📝 Creating audit log...');

  const audit = (entity: string, action: string, entityId: string,
    performer: User, before: Record<string, unknown> | null,
    after: Record<string, unknown> | null, note: string | null = null, locationId: string | null = null) =>
    auditRepo.create({ entity, action, entityId, locationId, performedBy: performer, performedById: performer.id, before, after, note });

  await auditRepo.save([
    audit('shift', 'published', nbMon1.id, uMarcus, null,
      { status: 'published', location: 'North Beach', week: tw(0), shiftsPublished: 10 },
      null, loc1.id),
    audit('shift_assignment', 'assigned', aNbMon1Alice.id, uMarcus, null,
      { staffId: uAlice.id, staffName: 'Alice Thompson', shift: `North Beach ${tw(0)} 09:00–17:00` },
      null, loc1.id),
    audit('shift_assignment', 'assigned', aNbFri2Grace.id, uMarcus, null,
      { staffId: uGrace.id, staffName: 'Grace Kim', shift: `North Beach ${tw(4)} 17:00–23:00`, note: 'Premium Fri evening' },
      null, loc1.id),
    audit('shift_assignment', 'assigned_with_override', aMeThu2Carol.id, uMarcus,
      { violations: ['7th consecutive working day — scheduling block triggered'] },
      { staffId: uCarol.id, staffName: 'Carol Williams', overrideReason: 'Carol volunteered. Only certified Line Cook / Shift Lead available for this slot. Monitoring for fatigue.' },
      'Carol volunteered. Only certified Line Cook / Shift Lead available. Monitoring for fatigue.', loc2.id),
    audit('swap_request', 'created', swap1.id, uAlice, null,
      { from: 'Alice Thompson', to: 'Henry Wilson', shift: `North Beach ${tw(3)} 09:00–17:00`, reason: 'Family obligation' },
      null, loc1.id),
    audit('swap_request', 'accepted', swap1.id, uHenry,
      { status: 'pending' }, { status: 'accepted', acceptedBy: 'Henry Wilson' },
      null, loc1.id),
    audit('swap_request', 'created', swap2.id, uBob, null,
      { from: 'Bob Martinez', to: 'Grace Kim', shift: `North Beach ${tw(3)} 17:00–23:00`, reason: 'Dentist appointment' },
      null, loc1.id),
    audit('swap_request', 'denied', swap3.id, uMarcus,
      { status: 'accepted' }, { status: 'denied', managerNote: 'Short-staffed that day.' },
      'Short-staffed that day — cannot approve.', loc2.id),
    audit('drop_request', 'created', drop1.id, uFrank, null,
      { assignmentId: aSmSat.id, shift: `Santa Monica ${tw(5)} 14:00–22:00`, reason: 'Family emergency' },
      null, loc4.id),
    audit('drop_request', 'claimed', drop1.id, uCarol,
      { status: 'open' }, { status: 'claimed', claimedBy: 'Carol Williams', claimedById: uCarol.id },
      null, loc4.id),
    audit('shift', 'updated', meWed.id, uMarcus,
      { startTime: '17:00', notes: null },
      { startTime: '18:00', notes: 'Dave available from 18:00 only (appointment)' },
      'Adjusted per Dave\'s availability exception for Wednesday', loc2.id),
    audit('shift_assignment', 'assigned_with_override', lwShifts[17].id, uMarcus,
      { violations: ['7th consecutive working day — scheduling block triggered'] },
      { staffId: uCarol.id, staffName: 'Carol Williams', week: lw(0), overrideReason: 'Only qualified Shift Lead for Sunday close. Carol confirmed she is able.' },
      'Only qualified Shift Lead for Sunday close. Carol confirmed she is able.', loc2.id),
  ]);
  console.log('  ✓ 12 audit log entries\n');

  console.log('🏖️  Creating time-off requests...');

  const reviewed = new Date();
  reviewed.setDate(reviewed.getDate() - 2);

  await timeOffRepo.save([
    timeOffRepo.create({
      staff: uAlice, staffId: uAlice.id,
      startDate: nw(0), endDate: nw(2),
      reason: 'Family vacation planned months ago.',
      status: TimeOffStatus.APPROVED,
      reviewedBy: uMarcus, reviewedById: uMarcus.id,
      managerNote: 'Approved — ensure North Beach has sufficient coverage Mon–Wed.',
      reviewedAt: reviewed,
    }),
    timeOffRepo.create({
      staff: uBob, staffId: uBob.id,
      startDate: nw(5), endDate: nw(6),
      reason: 'Wedding out of town.',
      status: TimeOffStatus.PENDING,
    }),
    timeOffRepo.create({
      staff: uEmma, staffId: uEmma.id,
      startDate: tw(3), endDate: tw(4),
      reason: 'Need a couple of days to recover — feeling burned out.',
      status: TimeOffStatus.DENIED,
      reviewedBy: uPriya, reviewedById: uPriya.id,
      managerNote: 'Short-staffed this week — cannot approve mid-week. Please request in advance.',
      reviewedAt: reviewed,
    }),
    timeOffRepo.create({
      staff: uDave, staffId: uDave.id,
      startDate: tw(0), endDate: tw(0),
      reason: 'Personal errand.',
      status: TimeOffStatus.CANCELLED,
    }),
    timeOffRepo.create({
      staff: uGrace, staffId: uGrace.id,
      startDate: nw(1), endDate: nw(3),
      reason: 'Out-of-town training course.',
      status: TimeOffStatus.PENDING,
    }),
    timeOffRepo.create({
      staff: uCarol, staffId: uCarol.id,
      startDate: lw(3), endDate: lw(3),
      reason: 'Medical appointment.',
      status: TimeOffStatus.APPROVED,
      reviewedBy: uMarcus, reviewedById: uMarcus.id,
      managerNote: 'Approved.',
      reviewedAt: reviewed,
    }),
  ]);
  console.log('  ✓ 6 time-off requests (approved, pending ×2, denied, cancelled, approved historical)\n');

  console.log('📓 Creating log book entries...');

  await logRepo.save([
    logRepo.create({
      date: lw(0), location: loc1, locationId: loc1.id,
      note: 'Busy Monday lunch rush. Short one server by 12:00 — Henry covered the gap well. POS terminal 2 intermittent issues, IT notified.',
      author: uMarcus, authorId: uMarcus.id,
    }),
    logRepo.create({
      date: lw(2), location: loc1, locationId: loc1.id,
      note: 'Mid-week quiet. Did a full inventory count — bar stock low on house gin, reorder submitted. All staff on time.',
      author: uMarcus, authorId: uMarcus.id,
    }),
    logRepo.create({
      date: lw(4), location: loc1, locationId: loc1.id,
      note: 'Friday premium evening went smoothly. Grace handled bar solo without issues. Strong tips night for the team.',
      author: uMarcus, authorId: uMarcus.id,
    }),
    logRepo.create({
      date: lw(3), location: loc3, locationId: loc3.id,
      note: 'One customer complaint about wait time during dinner peak. Emma handled it professionally — comp dessert issued. No escalation.',
      author: uPriya, authorId: uPriya.id,
    }),
    logRepo.create({
      date: lw(5), location: loc3, locationId: loc3.id,
      note: 'Saturday great turnover. Tested new seating layout — positive feedback. Prep team was 15 min late; addressed in debrief.',
      author: uPriya, authorId: uPriya.id,
    }),
    logRepo.create({
      date: tw(0), location: loc1, locationId: loc1.id,
      note: 'Monday opening smooth. Alice and Henry covered AM well. POS terminal 2 issue resolved by IT this morning. New specials board up.',
      author: uMarcus, authorId: uMarcus.id,
    }),
    logRepo.create({
      date: tw(1), location: loc1, locationId: loc1.id,
      note: 'Quiet Tuesday. Used downtime to train Henry on closing procedures. Noted drain in back of house is slow — maintenance request submitted.',
      author: uMarcus, authorId: uMarcus.id,
    }),
    logRepo.create({
      date: tw(0), location: loc2, locationId: loc2.id,
      note: "Dave's swap request for Monday was denied — had to cover himself. Professional about it. Shift ran without issues.",
      author: uMarcus, authorId: uMarcus.id,
    }),
    logRepo.create({
      date: tw(1), location: loc4, locationId: loc4.id,
      note: "Frank called ahead about Saturday — family emergency. Drop request submitted and claimed by Carol. Waiting on Priya's approval.",
      author: uPriya, authorId: uPriya.id,
    }),
  ]);
  console.log('  ✓ 9 log book entries (last week + this week across locations)\n');

  console.log('🍽️  Creating menu items...');
  await menuRepo.save([
    menuRepo.create({ name: 'Grilled Sea Bass',  description: 'Ocean-fresh, herb-crusted with lemon beurre blanc',        price: 38, category: 'Mains',    tag: "Chef's Pick",   tagColor: 'cyan',   isTodaysHighlight: true,  sortOrder: 1 }),
    menuRepo.create({ name: 'Lobster Risotto',   description: 'Creamy arborio with Nova Scotia lobster & saffron',         price: 52, category: 'Mains',    tag: 'Signature',     tagColor: 'violet', isTodaysHighlight: true,  sortOrder: 2 }),
    menuRepo.create({ name: 'Wagyu Tenderloin',  description: '48-hour sous vide, black truffle jus & pomme purée',        price: 68, category: 'Mains',    tag: 'Premium',       tagColor: 'pink',   isTodaysHighlight: true,  sortOrder: 3 }),
    menuRepo.create({ name: 'Tuna Tataki',       description: 'Seared yellowfin, ponzu dressing & microgreens',            price: 29, category: 'Starters', tag: 'Light',         tagColor: 'cyan',   isTodaysHighlight: true,  sortOrder: 4 }),
    menuRepo.create({ name: 'Bouillabaisse',     description: "Classic Provençal fisherman's stew with rouille toast",     price: 44, category: 'Mains',    tag: 'Traditional',   tagColor: 'violet', isTodaysHighlight: true,  sortOrder: 5 }),
    menuRepo.create({ name: 'Miso Black Cod',    description: '72-hour Nobu-style marinade with pickled cucumber',         price: 46, category: 'Mains',    tag: 'Fan Favourite', tagColor: 'pink',   isTodaysHighlight: true,  sortOrder: 6 }),
    menuRepo.create({ name: 'Chowder Crostini',  description: 'House-made clam chowder on toasted sourdough with chives',  price: 14, category: 'Starters', tag: 'Starter',       tagColor: 'cyan',   isTodaysHighlight: false, sortOrder: 7 }),
    menuRepo.create({ name: 'Seared Scallops',   description: 'Hand-dived scallops, cauliflower purée & crispy capers',    price: 24, category: 'Starters', tag: 'Seasonal',      tagColor: 'violet', isTodaysHighlight: false, sortOrder: 8 }),
    menuRepo.create({ name: 'Sticky Toffee Pudding', description: 'Warm date sponge, toffee sauce & clotted cream',        price: 11, category: 'Desserts', tag: 'Dessert',       tagColor: 'pink',   isTodaysHighlight: false, sortOrder: 9 }),
    menuRepo.create({ name: 'Dark Chocolate Torte',  description: 'Valrhona chocolate, salted caramel & hazelnut crumble', price: 12, category: 'Desserts', tag: 'Dessert',       tagColor: 'violet', isTodaysHighlight: false, sortOrder: 10 }),
  ]);
  console.log('  ✓ 10 menu items (6 today\'s highlights + 4 full menu)\n');

  console.log('📅 Creating reservations...');
  await reservRepo.save([
    reservRepo.create({ customerName: 'Aoife Murphy',    email: 'aoife@example.com',    phone: '+353876001001', date: today, time: '19:00', partySize: 2, locationId: loc1.id, status: ReservationStatus.CONFIRMED, notes: 'Window seat requested' }),
    reservRepo.create({ customerName: "Conor O'Brien",   email: 'conor@example.com',    phone: null,            date: today, time: '19:30', partySize: 4, locationId: loc2.id, status: ReservationStatus.PENDING }),
    reservRepo.create({ customerName: 'Siobhán Kelly',   email: 'siobhan@example.com',  phone: '+353871002002', date: today, time: '20:00', partySize: 6, locationId: loc1.id, status: ReservationStatus.CONFIRMED, notes: 'Birthday celebration — please arrange dessert plate' }),
    reservRepo.create({ customerName: 'Liam Walsh',      email: 'liam@example.com',     phone: null,            date: today, time: '20:30', partySize: 2, locationId: loc3.id, status: ReservationStatus.PENDING }),
    reservRepo.create({ customerName: 'Niamh Burke',     email: 'niamh@example.com',    phone: '+353851003003', date: tw(1), time: '18:30', partySize: 3, locationId: loc1.id, status: ReservationStatus.PENDING }),
    reservRepo.create({ customerName: 'Declan Foley',    email: 'declan@example.com',   phone: '+353861004004', date: tw(1), time: '19:00', partySize: 8, locationId: loc2.id, status: ReservationStatus.CONFIRMED, notes: 'Corporate dinner — separate bill per person' }),
    reservRepo.create({ customerName: 'Fiona McCarthy',  email: 'fiona@example.com',    phone: null,            date: tw(2), time: '13:00', partySize: 2, locationId: loc3.id, status: ReservationStatus.PENDING }),
    reservRepo.create({ customerName: 'Seán Brennan',    email: 'sean@example.com',     phone: '+353871005005', date: tw(4), time: '20:00', partySize: 4, locationId: loc1.id, status: ReservationStatus.PENDING, notes: 'Vegetarian options for 2 guests' }),
    reservRepo.create({ customerName: 'Ciara Flynn',     email: 'ciara@example.com',    phone: null,            date: tw(5), time: '19:00', partySize: 2, locationId: loc2.id, status: ReservationStatus.CANCELLED }),
    reservRepo.create({ customerName: 'Patrick Ryan',    email: 'patrick@example.com',  phone: '+353876006006', date: tw(5), time: '20:30', partySize: 5, locationId: loc1.id, status: ReservationStatus.PENDING }),
  ]);
  console.log('  ✓ 10 reservations (today + this week across locations)\n');

  console.log('🔖 Creating bookmarks...');
  await bookmarkRepo.save([
    bookmarkRepo.create({ userId: uAdmin.id,   label: 'Schedule',      href: '/schedule' }),
    bookmarkRepo.create({ userId: uAdmin.id,   label: 'Staff',         href: '/staff' }),
    bookmarkRepo.create({ userId: uAdmin.id,   label: 'Analytics',     href: '/analytics' }),
    bookmarkRepo.create({ userId: uAdmin.id,   label: 'Audit Log',     href: '/audit' }),
    bookmarkRepo.create({ userId: uMarcus.id,  label: 'Schedule',      href: '/schedule' }),
    bookmarkRepo.create({ userId: uMarcus.id,  label: 'Swap & Drop',   href: '/swap-requests' }),
    bookmarkRepo.create({ userId: uMarcus.id,  label: 'Log Book',      href: '/log-book' }),
    bookmarkRepo.create({ userId: uMarcus.id,  label: 'Reservations',  href: '/reservations' }),
    bookmarkRepo.create({ userId: uPriya.id,   label: 'Schedule',      href: '/schedule' }),
    bookmarkRepo.create({ userId: uPriya.id,   label: 'Time Off',      href: '/time-off' }),
    bookmarkRepo.create({ userId: uPriya.id,   label: 'Menu',          href: '/menu' }),
    bookmarkRepo.create({ userId: uAlice.id,   label: 'My Schedule',   href: '/my-schedule' }),
    bookmarkRepo.create({ userId: uAlice.id,   label: 'Time Off',      href: '/time-off' }),
    bookmarkRepo.create({ userId: uAlice.id,   label: 'Open Shifts',   href: '/pickup' }),
    bookmarkRepo.create({ userId: uGrace.id,   label: 'My Schedule',   href: '/my-schedule' }),
    bookmarkRepo.create({ userId: uGrace.id,   label: 'Swap & Drop',   href: '/swap-requests' }),
    bookmarkRepo.create({ userId: uGrace.id,   label: 'Availability',  href: '/settings/availability' }),
  ]);
  console.log('  ✓ 17 bookmarks seeded across admin, managers, and staff\n');

  // ── NEW MODULES ────────────────────────────────────────────────────────────

  console.log('📐 Creating schedule templates...');
  const openingItems = [
    { id: '1', label: 'Unlock front door',             required: true,  completedAt: null, completedById: null },
    { id: '2', label: 'Check refrigerator temperatures', required: true, completedAt: null, completedById: null },
    { id: '3', label: 'Count cash drawer',              required: true,  completedAt: null, completedById: null },
    { id: '4', label: 'Review reservation list',        required: false, completedAt: null, completedById: null },
    { id: '5', label: 'Brief staff on specials',        required: false, completedAt: null, completedById: null },
  ];
  const closingItems = [
    { id: '1', label: 'Close out all POS terminals',       required: true,  completedAt: null, completedById: null },
    { id: '2', label: 'Clean and sanitize all surfaces',   required: true,  completedAt: null, completedById: null },
    { id: '3', label: 'Lock all doors and windows',        required: true,  completedAt: null, completedById: null },
    { id: '4', label: 'Complete end-of-night cash count',  required: true,  completedAt: null, completedById: null },
    { id: '5', label: 'Set alarm system',                  required: false, completedAt: null, completedById: null },
  ];

  const makeTemplates = (loc: Location) => [
    templateRepo.create({
      name: 'Standard Week',
      location: loc,
      locationId: loc.id,
      createdById: uMarcus.id,
      shifts: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '16:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 0, startTime: '17:00', endTime: '23:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 1, startTime: '17:00', endTime: '23:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 2, startTime: '17:00', endTime: '23:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 3, startTime: '17:00', endTime: '23:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 4, startTime: '17:00', endTime: '23:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
        { dayOfWeek: 4, startTime: '20:00', endTime: '02:00', requiredSkillId: sBartender.id, headcount: 1, notes: 'Overnight closing' },
        { dayOfWeek: 5, startTime: '20:00', endTime: '02:00', requiredSkillId: sBartender.id, headcount: 1, notes: 'Overnight closing' },
      ],
    }),
    templateRepo.create({
      name: 'Weekend Rush',
      location: loc,
      locationId: loc.id,
      createdById: uMarcus.id,
      shifts: [
        { dayOfWeek: 4, startTime: '17:00', endTime: '23:00', requiredSkillId: sServer.id,    headcount: 3, notes: null },
        { dayOfWeek: 5, startTime: '11:00', endTime: '19:00', requiredSkillId: sServer.id,    headcount: 3, notes: null },
        { dayOfWeek: 5, startTime: '17:00', endTime: '23:00', requiredSkillId: sBartender.id, headcount: 2, notes: null },
        { dayOfWeek: 6, startTime: '11:00', endTime: '18:00', requiredSkillId: sServer.id,    headcount: 2, notes: null },
      ],
    }),
  ];

  await templateRepo.save([
    ...makeTemplates(loc1),
    ...makeTemplates(loc2),
    ...makeTemplates(loc3),
    ...makeTemplates(loc4),
  ]);
  console.log('  ✓ 8 schedule templates (2 per location)\n');

  console.log('🏅 Creating certifications...');
  const allStaffAndManagers = [uMarcus, uPriya, uAlice, uBob, uCarol, uDave, uEmma, uFrank, uGrace, uHenry];
  const halfStaff           = [uAlice, uCarol, uDave, uEmma, uGrace];
  const bartenders          = [uBob, uGrace];

  const certRows: Partial<Certification>[] = [];

  // Food Handler Card — all staff & managers
  for (const u of allStaffAndManagers) {
    certRows.push(certRepo.create({
      userId: u.id,
      name: 'Food Handler Card',
      issuedDate: '2024-01-15',
      expiryDate: '2026-01-15',
      issuer: 'National Registry of Food Safety Professionals',
      documentUrl: null,
    }));
  }

  // ServSafe Manager — half of staff (EXPIRED — useful for expiry alert tests)
  for (const u of halfStaff) {
    certRows.push(certRepo.create({
      userId: u.id,
      name: 'ServSafe Manager',
      issuedDate: '2023-06-01',
      expiryDate: '2025-06-01',
      issuer: 'National Restaurant Association',
      documentUrl: null,
    }));
  }

  // TIPS Alcohol Service — bartenders (Bob & Grace)
  for (const u of bartenders) {
    certRows.push(certRepo.create({
      userId: u.id,
      name: 'TIPS Alcohol Service',
      issuedDate: '2024-03-01',
      expiryDate: '2027-03-01',
      issuer: 'Health Communications Inc.',
      documentUrl: null,
    }));
  }

  await certRepo.save(certRows);
  console.log(`  ✓ ${certRows.length} certifications (Food Handler ×${allStaffAndManagers.length}, ServSafe ×${halfStaff.length} expired, TIPS ×${bartenders.length})\n`);

  console.log('⏱️  Creating timesheets...');
  // Last week APPROVED timesheets — pick 7 representative assignments from lwAssignments
  // lwAssignments indices: [0]=Alice lw(0) 09-17, [1]=Henry lw(0) 09-17,
  // [2]=Bob lw(0) 17-23, [3]=Alice lw(1) 09-17, [4]=Bob lw(1) 17-23,
  // [5]=Alice lw(2) 09-17, [6]=Bob lw(2) 17-23, [7]=Alice lw(3) 09-17
  const lwTimesheets = [
    { a: lwAssignments[0], staff: uAlice, shift: lwShifts[0], date: lw(0), ci: '09:05', co: '17:10', brk: 30, hours: 7.58 },
    { a: lwAssignments[1], staff: uHenry, shift: lwShifts[0], date: lw(0), ci: '08:55', co: '17:00', brk: 30, hours: 7.58 },
    { a: lwAssignments[2], staff: uBob,   shift: lwShifts[1], date: lw(0), ci: '17:02', co: '23:05', brk: 30, hours: 5.55 },
    { a: lwAssignments[3], staff: uAlice, shift: lwShifts[2], date: lw(1), ci: '09:00', co: '17:00', brk: 30, hours: 7.50 },
    { a: lwAssignments[4], staff: uBob,   shift: lwShifts[3], date: lw(1), ci: '17:00', co: '23:00', brk: 30, hours: 5.50 },
    { a: lwAssignments[5], staff: uAlice, shift: lwShifts[4], date: lw(2), ci: '08:58', co: '17:03', brk: 30, hours: 7.58 },
    { a: lwAssignments[6], staff: uBob,   shift: lwShifts[5], date: lw(2), ci: '17:00', co: '23:00', brk: 30, hours: 5.50 },
  ];

  const reviewedByMarcus = new Date();
  reviewedByMarcus.setDate(reviewedByMarcus.getDate() - 3);

  for (const t of lwTimesheets) {
    await timesheetRepo.save(timesheetRepo.create({
      staffId:      t.staff.id,
      shiftId:      t.shift.id,
      assignmentId: t.a.id,
      locationId:   t.shift.locationId,
      clockIn:      new Date(`${t.date}T${t.ci}:00`),
      clockOut:     new Date(`${t.date}T${t.co}:00`),
      breakMinutes: t.brk,
      actualHours:  t.hours,
      status:       TimesheetStatus.APPROVED,
      reviewedById: uMarcus.id,
      managerNote:  'Approved.',
      reviewedAt:   reviewedByMarcus,
    }));
  }

  // This-week PENDING timesheets for a couple of completed-looking shifts
  const twTimesheets = [
    { a: aNbMon1Alice, staff: uAlice, shift: nbMon1, date: tw(0), ci: '09:02', co: '17:00', brk: 30, hours: 7.47 },
    { a: aNbMon2Bob,   staff: uBob,   shift: nbMon2, date: tw(0), ci: '17:00', co: '23:05', brk: 30, hours: 5.58 },
  ];

  for (const t of twTimesheets) {
    await timesheetRepo.save(timesheetRepo.create({
      staffId:      t.staff.id,
      shiftId:      t.shift.id,
      assignmentId: t.a.id,
      locationId:   t.shift.locationId,
      clockIn:      new Date(`${t.date}T${t.ci}:00`),
      clockOut:     new Date(`${t.date}T${t.co}:00`),
      breakMinutes: t.brk,
      actualHours:  t.hours,
      status:       TimesheetStatus.PENDING,
      reviewedById: null,
      managerNote:  null,
      reviewedAt:   null,
    }));
  }
  console.log(`  ✓ ${lwTimesheets.length + twTimesheets.length} timesheets (${lwTimesheets.length} approved last week, ${twTimesheets.length} pending this week)\n`);

  console.log('💬 Creating messages...');
  // 1. Announcement from admin (Sarah Chen) to loc1
  const msg1 = await messageRepo.save(messageRepo.create({
    type:        MessageType.ANNOUNCEMENT,
    senderId:    uAdmin.id,
    recipientId: null,
    locationId:  loc1.id,
    body:        'Welcome to ShiftSync! Check your schedule for this week. Reach out to your manager if you have any questions.',
    isRead:      false,
  }));

  // 2. Direct message from manager (Marcus) to staff (Alice)
  const msg2 = await messageRepo.save(messageRepo.create({
    type:        MessageType.DIRECT,
    senderId:    uMarcus.id,
    recipientId: uAlice.id,
    locationId:  null,
    body:        'Hey Alice — can you cover Saturday evening (18:00–23:00) at North Beach? We\'re short a server. Let me know ASAP!',
    isRead:      false,
  }));

  // 3. Direct reply from Alice back to Marcus
  await messageRepo.save(messageRepo.create({
    type:        MessageType.DIRECT,
    senderId:    uAlice.id,
    recipientId: uMarcus.id,
    locationId:  null,
    body:        'Hi Marcus — I can do it! I\'ll be there at 17:45 to set up. Thanks for thinking of me.',
    isRead:      false,
  }));
  console.log('  ✓ 3 messages (1 announcement + 1 DM from manager + 1 DM reply)\n');

  console.log('✅ Creating checklists...');
  const checklistRows: ReturnType<typeof checklistRepo.create>[] = [];
  for (const loc of [loc1, loc2, loc3, loc4]) {
    checklistRows.push(
      checklistRepo.create({
        type:         ChecklistType.OPENING,
        title:        `Opening Checklist — ${loc.name}`,
        locationId:   loc.id,
        shiftId:      null,
        assignedToId: null,
        items:        openingItems,
        isCompleted:  false,
        completedAt:  null,
      }),
      checklistRepo.create({
        type:         ChecklistType.CLOSING,
        title:        `Closing Checklist — ${loc.name}`,
        locationId:   loc.id,
        shiftId:      null,
        assignedToId: null,
        items:        closingItems,
        isCompleted:  false,
        completedAt:  null,
      }),
    );
  }
  await checklistRepo.save(checklistRows);
  console.log('  ✓ 8 checklists (1 opening + 1 closing per location)\n');

  console.log('⭐ Creating shift feedback...');
  // Use 4 last-week assignments with sensible feedback
  const feedbackData = [
    { a: lwAssignments[0], staff: uAlice, rating: 5, comment: 'Great shift, well organised.', adequatelyStaffed: true,  wouldRepeat: true },
    { a: lwAssignments[2], staff: uBob,   rating: 4, comment: 'Busy but manageable.',         adequatelyStaffed: true,  wouldRepeat: true },
    { a: lwAssignments[5], staff: uAlice, rating: 4, comment: 'Great shift, well organised.', adequatelyStaffed: true,  wouldRepeat: true },
    { a: lwAssignments[6], staff: uBob,   rating: 5, comment: 'Busy but manageable.',         adequatelyStaffed: false, wouldRepeat: true },
  ];

  for (const f of feedbackData) {
    await feedbackRepo.save(feedbackRepo.create({
      staffId:          f.staff.id,
      assignmentId:     f.a.id,
      rating:           f.rating,
      comment:          f.comment,
      adequatelyStaffed: f.adequatelyStaffed,
      wouldRepeat:      f.wouldRepeat,
    }));
  }
  console.log(`  ✓ ${feedbackData.length} shift feedback entries\n`);

  console.log('⚖️  Creating Fair Workweek change logs...');
  // 1. Violation: shift modified inside advance-notice window (< 14 days) → predictability pay triggered
  const violationChangedAt = new Date(`${lw(4)}T10:00:00`); // changed Friday last week
  const violationShiftStart = new Date(`${lw(4)}T17:00:00`); // shift starts same day at 17:00
  const hoursViolation = (violationShiftStart.getTime() - violationChangedAt.getTime()) / (1000 * 60 * 60); // 7h

  await changeLogRepo.save(changeLogRepo.create({
    shiftId:                 lwShifts[9].id,   // loc1 Fri lw(4) 17:00–23:00 bartender
    changeType:              ChangeType.MODIFIED,
    changedAt:               violationChangedAt,
    hoursBeforeShift:        parseFloat(hoursViolation.toFixed(2)),
    triggersPredictabilityPay: true,
    predictabilityPayAmount: 18.00,            // approx: 6h * $15/hr * 0.2 premium
    changedById:             uMarcus.id,
  }));

  // 2. Compliant publish: schedule published > 14 days before shift
  const compliantChangedAt = new Date(`${lw(0)}T09:00:00`);  // published Monday last week
  const compliantShiftStart = new Date(`${tw(1)}T09:00:00`); // shift is next-week Tuesday
  const hoursCompliant = (compliantShiftStart.getTime() - compliantChangedAt.getTime()) / (1000 * 60 * 60);

  await changeLogRepo.save(changeLogRepo.create({
    shiftId:                 nbTue1.id,         // this-week Tue 09:00–17:00 server
    changeType:              ChangeType.PUBLISHED,
    changedAt:               compliantChangedAt,
    hoursBeforeShift:        parseFloat(hoursCompliant.toFixed(2)),
    triggersPredictabilityPay: false,
    predictabilityPayAmount: null,
    changedById:             uMarcus.id,
  }));
  console.log('  ✓ 2 Fair Workweek change logs (1 violation + 1 compliant publish)\n');

  await AppDataSource.destroy();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            ShiftSync — Seed Complete ✅                     ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Password for all accounts: Coastal2024!                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Email                  Name               Role             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  admin@coastal.com      Sarah Chen          Admin           ║');
  console.log('║  marcus@coastal.com     Marcus Johnson      Manager (ET)    ║');
  console.log('║  priya@coastal.com      Priya Patel         Manager (PT)    ║');
  console.log('║  alice@coastal.com      Alice Thompson      Staff           ║');
  console.log('║  bob@coastal.com        Bob Martinez        Staff           ║');
  console.log('║  carol@coastal.com      Carol Williams      Staff           ║');
  console.log('║  dave@coastal.com       Dave Park           Staff           ║');
  console.log('║  emma@coastal.com       Emma Rodriguez      Staff           ║');
  console.log('║  frank@coastal.com      Frank Chen          Staff           ║');
  console.log('║  grace@coastal.com      Grace Kim           Staff           ║');
  console.log('║  henry@coastal.com      Henry Wilson        Staff           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Edge cases ready for evaluation:                           ║');
  console.log('║  • Alice  — 40h this week Mon–Fri (OVERTIME)               ║');
  console.log('║  • Grace  — 6 consecutive days Mon–Sat (warning)           ║');
  console.log('║  • Emma   — 6 consecutive days Tue–Sun (warning)           ║');
  console.log('║  • Carol  — 7th day override used (audit trail present)    ║');
  console.log('║  • Swap   — Alice→Henry Thu AM (accepted, pending manager) ║');
  console.log('║  • Swap   — Bob→Grace Thu PM (pending response)            ║');
  console.log('║  • Drop   — Frank Sat SM (claimed by Carol, pending Priya) ║');
  console.log('║  • Alice exception — next Monday unavailable               ║');
  console.log('║  • Dave exception  — this Wednesday 18:00 start only       ║');
  console.log('║  • Henry exception — this Saturday 10:00–16:00 available   ║');
  console.log('║  • Overnight shift — North Beach Sat 22:00→04:00 (draft)   ║');
  console.log('║  • Unassigned shift— Midtown East Fri available for pickup ║');
  console.log('║  • Premium shifts  — Fri/Sat evenings NB + Marina (★)     ║');
  console.log('║  • Time-off        — approved/pending/denied/cancelled     ║');
  console.log('║  • Log book        — 9 entries across 4 locations          ║');
  console.log('║  • Confirmed       — Mon+Tue assignments have confirmedAt  ║');
  console.log('║  • Floor plan demo — all-day shifts today, all 4 locations ║');
  console.log('║  • Bookmarks       — 17 bookmarks across admin/mgr/staff   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  New module data:                                           ║');
  console.log('║  • Templates   — 8 (2 per location: Standard + Weekend)    ║');
  console.log('║  • Certs       — 17 (Food Handler ×10, ServSafe ×5, TIPS ×2)║');
  console.log('║  • Timesheets  — 9 (7 approved last wk, 2 pending this wk) ║');
  console.log('║  • Messages    — 3 (1 announcement + 2 DMs)                ║');
  console.log('║  • Checklists  — 8 (opening + closing per location)        ║');
  console.log('║  • Feedback    — 4 (last-week shifts, rating 4–5)          ║');
  console.log('║  • FWW logs    — 2 (1 violation, 1 compliant publish)      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message || err);
  process.exit(1);
});
