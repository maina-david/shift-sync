import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleTemplate } from './entities/schedule-template.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { CreateScheduleTemplateDto } from './dto/create-schedule-template.dto';
import { addDays } from '../common/timezone.util';

@Injectable()
export class ScheduleTemplatesService {
  constructor(
    @InjectRepository(ScheduleTemplate)
    private readonly templatesRepository: Repository<ScheduleTemplate>,

    @InjectRepository(Shift)
    private readonly shiftsRepository: Repository<Shift>,
  ) {}

  findAll(locationId?: string): Promise<ScheduleTemplate[]> {
    if (locationId) {
      return this.templatesRepository.find({
        where: { locationId },
        order: { createdAt: 'DESC' },
      });
    }
    return this.templatesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ScheduleTemplate> {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Schedule template ${id} not found`);
    }
    return template;
  }

  async create(
    dto: CreateScheduleTemplateDto,
    userId: string,
  ): Promise<ScheduleTemplate> {
    const template = this.templatesRepository.create({
      name: dto.name,
      locationId: dto.locationId,
      shifts: dto.shifts.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredSkillId: s.requiredSkillId ?? null,
        headcount: s.headcount,
        notes: s.notes ?? null,
      })),
      createdById: userId,
    });
    return this.templatesRepository.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templatesRepository.remove(template);
  }

  async apply(
    templateId: string,
    weekStart: string,
    _userId: string,
  ): Promise<{ shiftIds: string[] }> {
    const template = await this.findOne(templateId);

    const newShifts = template.shifts.map((templateShift) => {
      // weekStart is Monday (offset 0), dayOfWeek 0=Mon…6=Sun
      const date = addDays(weekStart, templateShift.dayOfWeek);
      const isOvernight = templateShift.endTime < templateShift.startTime;

      return this.shiftsRepository.create({
        locationId: template.locationId,
        date,
        startTime: templateShift.startTime,
        endTime: templateShift.endTime,
        requiredSkillId: templateShift.requiredSkillId ?? null,
        headcount: templateShift.headcount,
        notes: templateShift.notes ?? null,
        status: ShiftStatus.DRAFT,
        isOvernight,
        publishedAt: null,
        publishedById: null,
      });
    });

    const saved = await this.shiftsRepository.save(newShifts);
    return { shiftIds: saved.map((s) => s.id) };
  }
}
