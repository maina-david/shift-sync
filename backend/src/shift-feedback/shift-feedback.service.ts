import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftFeedback } from './entities/shift-feedback.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

export interface FeedbackSummary {
  locationId: string | null;
  startDate: string | null;
  endDate: string | null;
  totalResponses: number;
  averageRating: number | null;
  pctAdequatelyStaffed: number | null;
  pctWouldRepeat: number | null;
}

@Injectable()
export class ShiftFeedbackService {
  constructor(
    @InjectRepository(ShiftFeedback)
    private readonly repo: Repository<ShiftFeedback>,
    @InjectRepository(ShiftAssignment)
    private readonly assignmentRepo: Repository<ShiftAssignment>,
  ) {}

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async submit(staffId: string, dto: CreateFeedbackDto): Promise<ShiftFeedback> {
    // Validate that the assignment belongs to this staff member
    const assignment = await this.assignmentRepo.findOne({
      where: { id: dto.assignmentId },
      relations: ['shift'],
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${dto.assignmentId} not found`);
    }

    if (assignment.staffId !== staffId) {
      throw new ForbiddenException('You can only submit feedback for your own shift assignments');
    }

    // Prevent duplicate feedback for the same assignment
    const existing = await this.repo.findOne({
      where: { assignmentId: dto.assignmentId, staffId },
    });

    if (existing) {
      throw new ConflictException('You have already submitted feedback for this shift assignment');
    }

    const feedback = this.repo.create({
      staffId,
      assignmentId: dto.assignmentId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      adequatelyStaffed: dto.adequatelyStaffed ?? null,
      wouldRepeat: dto.wouldRepeat ?? null,
    });

    return this.repo.save(feedback);
  }

  // ─── Get for Shift ────────────────────────────────────────────────────────

  async getForShift(shiftId: string): Promise<ShiftFeedback[]> {
    return this.repo
      .createQueryBuilder('fb')
      .innerJoinAndSelect('fb.assignment', 'assignment')
      .leftJoinAndSelect('fb.staff', 'staff')
      .where('assignment.shiftId = :shiftId', { shiftId })
      .orderBy('fb.createdAt', 'DESC')
      .getMany();
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(
    locationId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<FeedbackSummary> {
    const qb = this.repo
      .createQueryBuilder('fb')
      .innerJoin('fb.assignment', 'assignment')
      .innerJoin('assignment.shift', 'shift');

    if (locationId) {
      qb.andWhere('shift.locationId = :locationId', { locationId });
    }

    if (startDate) {
      qb.andWhere('shift.date >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('shift.date <= :endDate', { endDate });
    }

    const rows = await qb.getMany();

    if (rows.length === 0) {
      return {
        locationId: locationId ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        totalResponses: 0,
        averageRating: null,
        pctAdequatelyStaffed: null,
        pctWouldRepeat: null,
      };
    }

    const totalResponses = rows.length;

    const avgRating =
      rows.reduce((sum, r) => sum + r.rating, 0) / totalResponses;

    const staffedResponses = rows.filter((r) => r.adequatelyStaffed !== null);
    const pctAdequatelyStaffed =
      staffedResponses.length > 0
        ? (staffedResponses.filter((r) => r.adequatelyStaffed === true).length /
            staffedResponses.length) *
          100
        : null;

    const repeatResponses = rows.filter((r) => r.wouldRepeat !== null);
    const pctWouldRepeat =
      repeatResponses.length > 0
        ? (repeatResponses.filter((r) => r.wouldRepeat === true).length /
            repeatResponses.length) *
          100
        : null;

    return {
      locationId: locationId ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      totalResponses,
      averageRating: parseFloat(avgRating.toFixed(2)),
      pctAdequatelyStaffed:
        pctAdequatelyStaffed !== null
          ? parseFloat(pctAdequatelyStaffed.toFixed(1))
          : null,
      pctWouldRepeat:
        pctWouldRepeat !== null ? parseFloat(pctWouldRepeat.toFixed(1)) : null,
    };
  }

  // ─── My Feedback ──────────────────────────────────────────────────────────

  async getMyFeedback(staffId: string): Promise<ShiftFeedback[]> {
    return this.repo.find({
      where: { staffId },
      relations: ['assignment'],
      order: { createdAt: 'DESC' },
    });
  }
}
