import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogEntry } from './entities/log-entry.entity';
import { CreateLogEntryDto } from './dto/create-log-entry.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class LogBookService {
  constructor(
    @InjectRepository(LogEntry) private repo: Repository<LogEntry>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async list(
    date: string,
    locationId: string | undefined,
    requestingUser: User,
  ): Promise<LogEntry[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.date = :date', { date })
      .orderBy('e.createdAt', 'DESC');

    if (requestingUser.role === UserRole.MANAGER) {
      const mgr = await this.userRepo.findOne({
        where: { id: requestingUser.id },
        relations: ['managedLocations'],
      });
      const managedIds = (mgr?.managedLocations ?? []).map((l) => l.id);
      if (managedIds.length === 0) return [];
      const scopedId =
        locationId && managedIds.includes(locationId) ? locationId : undefined;
      if (scopedId) {
        qb.andWhere('e.locationId = :locationId', { locationId: scopedId });
      } else {
        qb.andWhere('e.locationId IN (:...ids)', { ids: managedIds });
      }
    } else if (locationId) {
      qb.andWhere('e.locationId = :locationId', { locationId });
    }

    return qb.getMany();
  }

  async create(dto: CreateLogEntryDto, author: User): Promise<LogEntry> {
    if (author.role === UserRole.STAFF) throw new ForbiddenException();

    const entry = this.repo.create({
      date: dto.date,
      locationId: dto.locationId,
      note: dto.note,
      authorId: author.id,
    });
    return this.repo.save(entry);
  }

  async remove(id: string, requestingUser: User): Promise<void> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Log entry not found');
    if (
      requestingUser.role !== UserRole.ADMIN &&
      entry.authorId !== requestingUser.id
    ) {
      throw new ForbiddenException('You can only delete your own entries');
    }
    await this.repo.remove(entry);
  }
}
