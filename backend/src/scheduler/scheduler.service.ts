import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  Cron,
  CronExpression,
  Interval,
  SchedulerRegistry,
  Timeout,
} from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  ShiftAssignment,
  AssignmentStatus,
} from '../shifts/entities/shift-assignment.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import {
  TimeOffRequest,
  TimeOffStatus,
} from '../time-off-requests/entities/time-off-request.entity';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entities/reservation.entity';
import {
  SwapRequest,
  SwapRequestStatus,
} from '../swap-requests/entities/swap-request.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  Notification,
  NotificationType,
} from '../notifications/entities/notification.entity';
import { Certification } from '../certifications/entities/certification.entity';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(ShiftAssignment)
    private readonly assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(TimeOffRequest)
    private readonly timeOffRepo: Repository<TimeOffRequest>,
    @InjectRepository(Reservation)
    private readonly reservRepo: Repository<Reservation>,
    @InjectRepository(SwapRequest)
    private readonly swapRepo: Repository<SwapRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    private readonly events: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Event emission failed for "${event}": ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  onModuleInit() {
    this.logger.log(
      'SchedulerService online — cron jobs, intervals and timeout registered',
    );

    const ms = 24 * 60 * 60 * 1000;
    const handle = setInterval(
      () => void this.cleanupOldReadNotifications(),
      ms,
    );
    this.schedulerRegistry.addInterval('cleanup-old-notifications', handle);
    this.logger.log(
      'Dynamic interval registered: cleanup-old-notifications (every 24 h)',
    );
  }

  onModuleDestroy() {
    try {
      this.schedulerRegistry.deleteInterval('cleanup-old-notifications');
    } catch (_e) {
      // interval may not exist if module destroyed before it was registered
    }
  }

  @Cron('5 0 * * *', { name: 'complete-past-assignments' })
  async completePastAssignments(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const past = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoin('a.shift', 's')
      .where('a.status = :status', { status: AssignmentStatus.ASSIGNED })
      .andWhere('s.date < :today', { today })
      .select('a.id')
      .getMany();

    if (past.length === 0) return;

    await this.assignRepo.update(
      { id: In(past.map((a) => a.id)) },
      { status: AssignmentStatus.COMPLETED },
    );

    this.logger.log(
      `[complete-past-assignments] Marked ${past.length} assignment(s) as COMPLETED`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'daily-shift-reminders' })
  async sendDailyShiftReminders(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const assignments = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 's')
      .innerJoinAndSelect('s.location', 'loc')
      .leftJoinAndSelect('s.requiredSkill', 'skill')
      .where('s.date = :today', { today })
      .andWhere('a.status = :status', { status: AssignmentStatus.ASSIGNED })
      .getMany();

    for (const a of assignments) {
      const s = a.shift;
      const skillPart = s.requiredSkill ? ` · ${s.requiredSkill.name}` : '';
      this.safeEmit('notification.send', {
        userId: a.staffId,
        type: NotificationType.SHIFT_REMINDER,
        title: 'Shift Reminder — Today',
        message: `You have a shift today at ${s.location.name} from ${s.startTime}–${s.endTime}${skillPart}.`,
        entityType: 'shift',
        entityId: s.id,
      });
    }

    this.logger.log(
      `[daily-shift-reminders] Sent ${assignments.length} reminder(s) for ${today}`,
    );
  }

  @Cron('0 9 * * 1-5', { name: 'pending-timeoff-reminders' })
  async remindStalePendingTimeOff(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const stale = await this.timeOffRepo.find({
      where: { status: TimeOffStatus.PENDING, createdAt: LessThan(cutoff) },
    });

    if (stale.length === 0) return;

    const managers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role IN (:...roles)', {
        roles: [UserRole.ADMIN, UserRole.MANAGER],
      })
      .andWhere('u.isActive = :active', { active: true })
      .getMany();

    const count = stale.length;
    for (const manager of managers) {
      this.safeEmit('notification.send', {
        userId: manager.id,
        type: NotificationType.TIME_OFF_REMINDER,
        title: `${count} Time-Off Request${count > 1 ? 's' : ''} Pending Review`,
        message:
          `${count} time-off request${count > 1 ? 's have' : ' has'} been waiting for ` +
          `review for over 48 hours. Please take action.`,
        entityType: 'time_off_request',
        entityId: null,
      });
    }

    this.logger.log(
      `[pending-timeoff-reminders] ${count} stale request(s) → notified ${managers.length} manager(s)`,
    );
  }

  @Cron('0 10 * * 5', { name: 'weekly-schedule-check' })
  async warnUnpublishedSchedule(): Promise<void> {
    const now = new Date();
    const daysUntilMonday = now.getDay() === 0 ? 1 : 8 - now.getDay();

    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const weekLabel = `${fmt(nextMonday)} – ${fmt(nextSunday)}`;

    const publishedCount = await this.shiftRepo
      .createQueryBuilder('s')
      .where('s.date BETWEEN :start AND :end', {
        start: fmt(nextMonday),
        end: fmt(nextSunday),
      })
      .andWhere('s.status = :status', { status: ShiftStatus.PUBLISHED })
      .getCount();

    if (publishedCount > 0) {
      this.logger.log(
        `[weekly-schedule-check] ${publishedCount} published shift(s) for next week (${weekLabel}) — no warning sent`,
      );
      return;
    }

    const managers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role IN (:...roles)', {
        roles: [UserRole.ADMIN, UserRole.MANAGER],
      })
      .andWhere('u.isActive = :active', { active: true })
      .getMany();

    for (const manager of managers) {
      this.safeEmit('notification.send', {
        userId: manager.id,
        type: NotificationType.SCHEDULE_UNPUBLISHED_WARNING,
        title: 'Next Week Schedule Not Published',
        message:
          `No shifts have been published for next week (${weekLabel}). ` +
          `Publish the schedule before the weekend so staff can plan ahead.`,
        entityType: null,
        entityId: null,
      });
    }

    this.logger.log(
      `[weekly-schedule-check] 0 published shifts for next week — warned ${managers.length} manager(s)`,
    );
  }

  @Cron('0 8 * * 1', { name: 'cert-expiry-check' })
  async warnExpiringCertifications(): Promise<void> {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + 30);

    const todayStr = today.toISOString().slice(0, 10);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const expiring = await this.certRepo
      .createQueryBuilder('cert')
      .leftJoinAndSelect('cert.user', 'user')
      .where('cert.expiryDate >= :today', { today: todayStr })
      .andWhere('cert.expiryDate <= :cutoff', { cutoff: cutoffStr })
      .orderBy('cert.expiryDate', 'ASC')
      .getMany();

    if (expiring.length === 0) return;

    const managers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role IN (:...roles)', {
        roles: [UserRole.ADMIN, UserRole.MANAGER],
      })
      .andWhere('u.isActive = :active', { active: true })
      .getMany();

    const count = expiring.length;
    const names = [
      ...new Set(expiring.map((c) => c.user?.name).filter(Boolean)),
    ];
    const namesSummary =
      names.slice(0, 3).join(', ') +
      (names.length > 3 ? ` and ${names.length - 3} more` : '');

    for (const manager of managers) {
      this.safeEmit('notification.send', {
        userId: manager.id,
        type: NotificationType.CERT_EXPIRY_WARNING,
        title: `${count} Certification${count > 1 ? 's' : ''} Expiring Within 30 Days`,
        message: `${namesSummary} ${count > 1 ? 'have certifications' : 'has a certification'} expiring within 30 days. Please review and arrange renewals.`,
        entityType: 'certification',
        entityId: null,
      });
    }

    this.logger.log(
      `[cert-expiry-check] ${count} expiring cert(s) → notified ${managers.length} manager(s)`,
    );
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'reservation-no-show' })
  async markNoShowReservations(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
    const cutoffTime = [
      String(cutoff.getUTCHours()).padStart(2, '0'),
      String(cutoff.getUTCMinutes()).padStart(2, '0'),
    ].join(':');

    const eligible = await this.reservRepo
      .createQueryBuilder('r')
      .where('r.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      })
      .andWhere(
        '(r.date < :today OR (r.date = :today AND r.time <= :cutoffTime))',
        { today, cutoffTime },
      )
      .getMany();

    if (eligible.length === 0) return;

    await this.reservRepo.update(
      { id: In(eligible.map((r) => r.id)) },
      { status: ReservationStatus.NO_SHOW },
    );

    this.logger.log(
      `[reservation-no-show] Marked ${eligible.length} reservation(s) as NO_SHOW`,
    );
  }

  @Cron('0 */30 * * * *', { name: 'shift-reminders' })
  async sendShiftReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const todayDate = now.toISOString().split('T')[0];
    const tomorrowDate = new Date(now.getTime() + 86400000)
      .toISOString()
      .split('T')[0];

    const candidates = await this.shiftRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.assignments', 'a')
      .innerJoinAndSelect('a.staff', 'staff')
      .innerJoinAndSelect('s.location', 'loc')
      .where('s.status = :status', { status: ShiftStatus.PUBLISHED })
      .andWhere('s.date IN (:...dates)', { dates: [todayDate, tomorrowDate] })
      .andWhere('a.status = :assignedStatus', {
        assignedStatus: AssignmentStatus.ASSIGNED,
      })
      .getMany();

    const upcomingAssignments: Array<{
      assignmentId: string;
      staffId: string;
      shift: Shift;
    }> = [];

    for (const shift of candidates) {
      const shiftStart = new Date(`${shift.date}T${shift.startTime}:00Z`);
      if (shiftStart >= now && shiftStart <= windowEnd) {
        for (const assignment of shift.assignments) {
          upcomingAssignments.push({
            assignmentId: assignment.id,
            staffId: assignment.staffId,
            shift,
          });
        }
      }
    }

    if (upcomingAssignments.length === 0) return;

    const remindersSentToday = await this.notifRepo
      .createQueryBuilder('n')
      .where('n.type = :type', { type: NotificationType.SHIFT_REMINDER })
      .andWhere('n.entityType = :entityType', {
        entityType: 'shift_assignment',
      })
      .andWhere('n.entityId IN (:...ids)', {
        ids: upcomingAssignments.map((a) => a.assignmentId),
      })
      .andWhere('DATE(n.createdAt) = :today', { today: todayDate })
      .select('n.entityId', 'entityId')
      .getRawMany<{ entityId: string }>();

    const alreadyReminded = new Set(remindersSentToday.map((r) => r.entityId));

    let sentCount = 0;
    for (const { assignmentId, staffId, shift } of upcomingAssignments) {
      if (alreadyReminded.has(assignmentId)) continue;

      const minutesUntil = Math.round(
        (new Date(`${shift.date}T${shift.startTime}:00Z`).getTime() -
          now.getTime()) /
          60000,
      );
      const timeLabel =
        minutesUntil <= 60
          ? `in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`
          : `in about ${Math.round(minutesUntil / 60)} hour${Math.round(minutesUntil / 60) !== 1 ? 's' : ''}`;

      this.safeEmit('notification.send', {
        userId: staffId,
        type: NotificationType.SHIFT_REMINDER,
        title: 'Upcoming Shift Reminder',
        message: `Your shift at ${shift.location.name} starts ${timeLabel} (${shift.startTime}–${shift.endTime}).`,
        entityType: 'shift_assignment',
        entityId: assignmentId,
      });

      sentCount++;
    }

    if (sentCount > 0) {
      this.logger.log(
        `[shift-reminders] Sent ${sentCount} upcoming shift reminder(s) (window: now → +2 h)`,
      );
    }
  }

  @Interval('swap-pending-reminder', 12 * 60 * 60 * 1000)
  async remindUnansweredSwapRequests(): Promise<void> {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const stale = await this.swapRepo
      .createQueryBuilder('sr')
      .innerJoinAndSelect('sr.fromAssignment', 'a')
      .innerJoinAndSelect('a.shift', 's')
      .where('sr.status = :status', { status: SwapRequestStatus.PENDING })
      .andWhere('sr.createdAt <= :cutoff', { cutoff })
      .getMany();

    for (const swap of stale) {
      this.safeEmit('notification.send', {
        userId: swap.toUserId,
        type: NotificationType.SWAP_PENDING_REMINDER,
        title: 'Swap Request Awaiting Your Response',
        message:
          `A swap request for the shift on ${swap.fromAssignment?.shift?.date} ` +
          `has been waiting over 12 hours. Please accept or reject it.`,
        entityType: 'swap_request',
        entityId: swap.id,
      });
    }

    if (stale.length > 0) {
      this.logger.log(
        `[swap-pending-reminder] Nudged ${stale.length} unanswered swap recipient(s)`,
      );
    }
  }

  @Timeout('startup-check', 10_000)
  async startupCheck(): Promise<void> {
    const [
      pendingTimeOff,
      swapsAwaitingResponse,
      swapsAwaitingManager,
      pendingReservations,
    ] = await Promise.all([
      this.timeOffRepo.count({ where: { status: TimeOffStatus.PENDING } }),
      this.swapRepo.count({ where: { status: SwapRequestStatus.PENDING } }),
      this.swapRepo.count({ where: { status: SwapRequestStatus.ACCEPTED } }),
      this.reservRepo.count({ where: { status: ReservationStatus.PENDING } }),
    ]);

    this.logger.log(
      `[startup-check] Actionable items — ` +
        `Time-off pending: ${pendingTimeOff} | ` +
        `Swaps awaiting staff response: ${swapsAwaitingResponse} | ` +
        `Swaps awaiting manager: ${swapsAwaitingManager} | ` +
        `Reservations pending: ${pendingReservations}`,
    );
  }

  async cleanupOldReadNotifications(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.notifRepo
      .createQueryBuilder()
      .delete()
      .where('isRead = true')
      .andWhere('createdAt < :cutoff', { cutoff })
      .execute();

    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(
        `[cleanup-old-notifications] Deleted ${count} old read notification(s)`,
      );
    }
  }
}
