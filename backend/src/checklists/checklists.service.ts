import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Checklist } from './entities/checklist.entity';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(Checklist)
    private readonly repo: Repository<Checklist>,
  ) {}

  async create(dto: CreateChecklistDto, _creatorId: string): Promise<Checklist> {
    const items = dto.items.map((item) => ({
      id: crypto.randomUUID(),
      label: item.label,
      required: item.required,
      completedAt: null,
      completedById: null,
    }));

    const checklist = this.repo.create({
      type: dto.type,
      title: dto.title,
      locationId: dto.locationId,
      shiftId: dto.shiftId ?? null,
      assignedToId: dto.assignedToId ?? null,
      items,
      isCompleted: false,
      completedAt: null,
    });

    return this.repo.save(checklist);
  }

  async findAll(locationId?: string, date?: string, user?: User): Promise<Checklist[]> {
    const qb = this.repo
      .createQueryBuilder('cl')
      .leftJoinAndSelect('cl.location', 'location')
      .orderBy('cl.createdAt', 'DESC');

    if (user?.role === UserRole.MANAGER) {
      const managedIds = user.managedLocations?.map((l) => l.id) ?? [];
      if (locationId) {
        if (!managedIds.includes(locationId)) {
          throw new ForbiddenException('You do not manage this location');
        }
        qb.andWhere('cl.locationId = :locationId', { locationId });
      } else if (managedIds.length > 0) {
        qb.andWhere('cl.locationId IN (:...managedIds)', { managedIds });
      } else {
        return [];
      }
    } else if (locationId) {
      qb.andWhere('cl.locationId = :locationId', { locationId });
    }

    if (date) {
      qb.innerJoin('shifts', 'shift', 'shift.id = cl.shiftId AND shift.date = :date', { date });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Checklist> {
    const checklist = await this.repo.findOne({ where: { id } });
    if (!checklist) {
      throw new NotFoundException(`Checklist ${id} not found`);
    }
    return checklist;
  }

  async completeItem(checklistId: string, itemId: string, userId: string): Promise<Checklist> {
    const checklist = await this.findOne(checklistId);

    const itemIndex = checklist.items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Item ${itemId} not found in checklist ${checklistId}`);
    }

    const now = new Date().toISOString();
    checklist.items[itemIndex] = {
      ...checklist.items[itemIndex],
      completedAt: now,
      completedById: userId,
    };

    // Mark the checklist complete once all required items are done
    const allRequiredDone = checklist.items
      .filter((i) => i.required)
      .every((i) => i.completedAt !== null);

    if (allRequiredDone && !checklist.isCompleted) {
      checklist.isCompleted = true;
      checklist.completedAt = new Date();
    }

    return this.repo.save(checklist);
  }

  async remove(id: string): Promise<void> {
    const checklist = await this.findOne(id);
    await this.repo.remove(checklist);
  }
}
