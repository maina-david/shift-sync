import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Timesheet, TimesheetStatus } from './entities/timesheet.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ReviewTimesheetDto } from './dto/review-timesheet.dto';
import { SettingsService } from '../settings/settings.service';

export interface TimesheetQuery {
  staffId?: string;
  locationId?: string;
  allowedLocationIds?: string[];
  status?: TimesheetStatus;
  startDate?: string;
  endDate?: string;
}

export interface PayrollExportQuery {
  locationId?: string;
  allowedLocationIds?: string[];
  startDate: string;
  endDate: string;
  status?: TimesheetStatus;
}

interface PayrollRow {
  employeeName: string;
  email: string;
  location: string;
  shiftDate: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  actualHours: number;
  hourlyRate: number;
  regularPay: number;
  overtimeHours: number;
  overtimePay: number;
  totalPay: number;
}

@Injectable()
export class TimesheetsService {
  private readonly logger = new Logger(TimesheetsService.name);

  constructor(
    @InjectRepository(Timesheet)
    private repo: Repository<Timesheet>,
    @InjectRepository(ShiftAssignment)
    private assignmentRepo: Repository<ShiftAssignment>,
    private readonly settingsService: SettingsService,
    private readonly events: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Event emission failed for "${event}": ${(err as Error).message}`,
      );
    }
  }

  async clockIn(staffId: string, dto: ClockInDto): Promise<Timesheet> {
    if (!dto.assignmentId && !dto.shiftId) {
      throw new BadRequestException(
        "No shift selected. Please clock in from your schedule or select today's shift.",
      );
    }

    let locationId: string | null = null;
    let resolvedShiftId: string | null = dto.shiftId ?? null;

    if (dto.assignmentId) {
      const assignment = await this.assignmentRepo.findOne({
        where: { id: dto.assignmentId, staffId },
        relations: ['shift', 'shift.location'],
      });
      if (!assignment) {
        throw new NotFoundException(
          'Assignment not found or does not belong to you',
        );
      }
      resolvedShiftId = assignment.shiftId;
      locationId = assignment.shift?.locationId ?? null;
    } else if (dto.shiftId) {
      const assignment = await this.assignmentRepo.findOne({
        where: { shiftId: dto.shiftId, staffId },
        relations: ['shift'],
      });
      locationId = assignment?.shift?.locationId ?? null;
    }

    return this.dataSource.transaction(async (em) => {
      const open = await em.findOne(Timesheet, {
        where: { staffId, clockOut: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (open) {
        throw new ConflictException(
          'You are already clocked in. Please clock out before starting a new session.',
        );
      }

      const timesheet = em.create(Timesheet, {
        staffId,
        shiftId: resolvedShiftId,
        assignmentId: dto.assignmentId ?? null,
        clockIn: new Date(),
        clockOut: null,
        breakMinutes: 0,
        actualHours: null,
        locationId,
        status: TimesheetStatus.PENDING,
      });

      return em.save(Timesheet, timesheet);
    });
  }

  async clockOut(staffId: string, dto: ClockOutDto): Promise<Timesheet> {
    const timesheet = await this.repo.findOne({
      where: { staffId, clockOut: IsNull() },
    });
    if (!timesheet) {
      throw new NotFoundException(
        'No active clock-in session found. Please clock in first.',
      );
    }

    const now = new Date();
    const breakMinutes = dto.breakMinutes ?? 0;

    // actualHours = elapsed time minus break, floored to zero
    const elapsedHours =
      (now.getTime() - timesheet.clockIn.getTime()) / 3_600_000;
    const breakHours = breakMinutes / 60;
    const actualHours = Math.max(
      0,
      parseFloat((elapsedHours - breakHours).toFixed(2)),
    );

    timesheet.clockOut = now;
    timesheet.breakMinutes = breakMinutes;
    timesheet.actualHours = actualHours;
    timesheet.status = TimesheetStatus.PENDING;

    return this.repo.save(timesheet);
  }

  async findAll(query: TimesheetQuery): Promise<Timesheet[]> {
    const qb = this.repo
      .createQueryBuilder('ts')
      .leftJoinAndSelect('ts.staff', 'staff')
      .leftJoinAndSelect('ts.shift', 'shift')
      .orderBy('ts.clockIn', 'DESC');

    if (query.staffId) {
      qb.andWhere('ts.staffId = :staffId', { staffId: query.staffId });
    }
    if (query.locationId) {
      qb.andWhere('ts.locationId = :locationId', {
        locationId: query.locationId,
      });
    } else if (query.allowedLocationIds) {
      const ids =
        query.allowedLocationIds.length > 0
          ? query.allowedLocationIds
          : ['__none__'];
      qb.andWhere('ts.locationId IN (:...allowedLocationIds)', {
        allowedLocationIds: ids,
      });
    }
    if (query.status) {
      qb.andWhere('ts.status = :status', { status: query.status });
    }
    if (query.startDate) {
      qb.andWhere('ts.clockIn >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      // Include everything up to the end of the given day
      const end = new Date(query.endDate);
      end.setUTCHours(23, 59, 59, 999);
      qb.andWhere('ts.clockIn <= :endDate', { endDate: end });
    }

    return qb.getMany();
  }

  async findMine(staffId: string): Promise<Timesheet[]> {
    return this.repo.find({
      where: { staffId },
      order: { clockIn: 'DESC' },
    });
  }

  async getOpenTimesheet(staffId: string): Promise<Timesheet | null> {
    return this.repo.findOne({
      where: { staffId, clockOut: IsNull() },
    });
  }

  async review(
    id: string,
    dto: ReviewTimesheetDto,
    reviewer: User,
  ): Promise<Timesheet> {
    const timesheet = await this.repo.findOne({ where: { id } });
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }
    if (timesheet.clockOut === null) {
      throw new BadRequestException(
        'Cannot review a timesheet while the staff member is still clocked in',
      );
    }
    if (timesheet.status !== TimesheetStatus.PENDING) {
      throw new BadRequestException(
        `Timesheet has already been ${timesheet.status}. Only pending timesheets can be reviewed.`,
      );
    }

    if (reviewer.role === UserRole.MANAGER) {
      const managedIds = reviewer.managedLocations?.map((l) => l.id) ?? [];
      if (timesheet.locationId && !managedIds.includes(timesheet.locationId)) {
        throw new ForbiddenException(
          "You do not manage this timesheet's location",
        );
      }
    }

    timesheet.status = dto.status;
    timesheet.reviewedById = reviewer.id;
    timesheet.managerNote = dto.managerNote ?? null;
    timesheet.reviewedAt = new Date();

    const saved = await this.repo.save(timesheet);

    this.safeEmit('timesheet.reviewed', {
      timesheetId: saved.id,
      staffId: saved.staffId,
      status: saved.status,
      reviewerId: reviewer.id,
    });

    this.safeEmit('audit.log', {
      entity: 'timesheet',
      entityId: id,
      action: dto.status === TimesheetStatus.APPROVED ? 'approved' : 'rejected',
      locationId: timesheet.locationId,
      performedById: reviewer.id,
      after: { status: dto.status, managerNote: dto.managerNote },
    });

    return saved;
  }

  async export(query: PayrollExportQuery): Promise<string> {
    const status = query.status ?? TimesheetStatus.APPROVED;
    const payrollSettings = this.settingsService.getPayroll();
    const overtimeMultiplier = payrollSettings.overtimeMultiplier;

    // Hours beyond 8 in a single shift are billed at the overtime rate
    const perShiftOtThreshold = 8;

    const qb = this.repo
      .createQueryBuilder('ts')
      .leftJoinAndSelect('ts.staff', 'staff')
      .leftJoinAndSelect('ts.shift', 'shift')
      .leftJoinAndSelect('shift.location', 'location')
      .where('ts.status = :status', { status })
      .andWhere('ts.clockIn >= :startDate', {
        startDate: new Date(query.startDate),
      })
      .orderBy('ts.clockIn', 'ASC');

    const endDate = new Date(query.endDate);
    endDate.setUTCHours(23, 59, 59, 999);
    qb.andWhere('ts.clockIn <= :endDate', { endDate });

    if (query.locationId) {
      qb.andWhere('ts.locationId = :locationId', {
        locationId: query.locationId,
      });
    } else if (query.allowedLocationIds) {
      const ids =
        query.allowedLocationIds.length > 0
          ? query.allowedLocationIds
          : ['__none__'];
      qb.andWhere('ts.locationId IN (:...allowedLocationIds)', {
        allowedLocationIds: ids,
      });
    }

    const timesheets = await qb.getMany();

    const rows: PayrollRow[] = timesheets.map((ts) => {
      const actualHours = ts.actualHours ? Number(ts.actualHours) : 0;
      const hourlyRate = ts.staff?.hourlyRate ? Number(ts.staff.hourlyRate) : 0;

      const regularHours = Math.min(actualHours, perShiftOtThreshold);
      const overtimeHours = Math.max(0, actualHours - perShiftOtThreshold);

      const regularPay = parseFloat((regularHours * hourlyRate).toFixed(2));
      const overtimePay = parseFloat(
        (overtimeHours * hourlyRate * overtimeMultiplier).toFixed(2),
      );
      const totalPay = parseFloat((regularPay + overtimePay).toFixed(2));

      const shiftDate = ts.shift?.date ?? ts.clockIn.toISOString().slice(0, 10);
      const locationName = ts.shift?.location?.name ?? ts.locationId ?? '';

      return {
        employeeName: ts.staff?.name ?? '',
        email: ts.staff?.email ?? '',
        location: locationName,
        shiftDate,
        clockIn: ts.clockIn.toISOString(),
        clockOut: ts.clockOut ? ts.clockOut.toISOString() : '',
        breakMinutes: ts.breakMinutes,
        actualHours,
        hourlyRate,
        regularPay,
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        overtimePay,
        totalPay,
      };
    });

    const header = [
      'Employee Name',
      'Email',
      'Location',
      'Shift Date',
      'Clock In',
      'Clock Out',
      'Break (min)',
      'Actual Hours',
      'Hourly Rate',
      'Regular Pay',
      'Overtime Hours',
      'Overtime Pay',
      'Total Pay',
    ].join(',');

    const csvRows = rows.map((r) =>
      [
        this.csvEscape(r.employeeName),
        this.csvEscape(r.email),
        this.csvEscape(r.location),
        r.shiftDate,
        r.clockIn,
        r.clockOut,
        r.breakMinutes,
        r.actualHours,
        r.hourlyRate,
        r.regularPay,
        r.overtimeHours,
        r.overtimePay,
        r.totalPay,
      ].join(','),
    );

    return [header, ...csvRows].join('\n');
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
