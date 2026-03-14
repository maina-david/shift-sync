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
import { Notification } from '../notifications/entities/notification.entity';

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
    private readonly events: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(`Event emission failed for "${event}": ${(err as Error).message}`, (err as Error).stack);
    }
  }

  onModuleInit() {
    this.logger.log('SchedulerService online — cron jobs, intervals and timeout registered');

    const ms = 24 * 60 * 60 * 1000;
    const handle = setInterval(
      () => void this.cleanupOldReadNotifications(),
      ms,
    );
    this.schedulerRegistry.addInterval('cleanup-old-notifications', handle);
    this.logger.log('Dynamic interval registered: cleanup-old-notifications (every 24 h)');
  }

  onModuleDestroy() {
    try {
      this.schedulerRegistry.deleteInterval('cleanup-old-notifications');
    } catch (_e) {
      // interval may not exist if module destroyed before it was registered
    }
  }

  // ─── CRON: 00:05 nightly ───────────────────────────────────────────────────

  /**
   * Marks all ASSIGNED shift-assignments whose shift date has passed as
   * COMPLETED so the history is accurate and queries stay fast.
   *
   * Runs at 00:05 so the calendar day has firmly rolled over.
   */
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

  // ─── CRON: 07:00 every day ─────────────────────────────────────────────────

  /**
   * Sends an in-app (and optionally email) reminder to every staff member
   * who has a shift today, so they can plan their commute and preparation.
   */
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
        type: 'SHIFT_REMINDER',
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

  // ─── CRON: 09:00 on weekdays ───────────────────────────────────────────────

  /**
   * Reminds every active manager/admin about time-off requests that have
   * been sitting in PENDING status for more than 48 hours without a decision.
   *
   * Only fires Mon–Fri to avoid noise over the weekend.
   */
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
        type: 'TIME_OFF_REMINDER',
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

  // ─── CRON: 10:00 every Friday ──────────────────────────────────────────────

  /**
   * Checks whether any shifts have been published for next week.
   * If none exist, warns every active manager/admin so the schedule
   * can be released before the weekend — giving staff enough lead time.
   */
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
        type: 'SCHEDULE_UNPUBLISHED_WARNING',
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

  // ─── CRON: every 30 minutes ────────────────────────────────────────────────

  /**
   * Auto-marks reservations as NO_SHOW when the guest has not arrived
   * within 30 minutes of their booked time and the status is still
   * PENDING or CONFIRMED.
   *
   * Compares purely on date/time strings so no timezone conversion is needed
   * (reservation times are already stored in local restaurant time).
   */
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'reservation-no-show' })
  async markNoShowReservations(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
    const cutoffTime = [
      String(cutoff.getHours()).padStart(2, '0'),
      String(cutoff.getMinutes()).padStart(2, '0'),
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

  // ─── INTERVAL: every 12 hours ──────────────────────────────────────────────

  /**
   * Sends a nudge to every staff member who has a swap request sitting
   * in PENDING status (i.e. they haven't accepted or rejected yet) for
   * more than 12 hours, so the requester isn't left hanging.
   */
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
        type: 'SWAP_PENDING_REMINDER',
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

  // ─── TIMEOUT: 10 seconds after startup ─────────────────────────────────────

  /**
   * Fires once, 10 seconds after the application starts.
   * Logs a quick snapshot of actionable pending items so operators have
   * immediate visibility without opening a dashboard.
   */
  @Timeout('startup-check', 10_000)
  async startupCheck(): Promise<void> {
    const [pendingTimeOff, swapsAwaitingResponse, swapsAwaitingManager, pendingReservations] =
      await Promise.all([
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

  // ─── DYNAMIC (SchedulerRegistry) ───────────────────────────────────────────

  /**
   * Registered dynamically via SchedulerRegistry in onModuleInit.
   * Deletes read notifications older than 30 days to keep the table lean.
   * Not a decorator — demonstrates the programmatic scheduling API.
   */
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
