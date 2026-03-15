import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { Skill } from '../skills/entities/skill.entity';
import { Location } from '../locations/entities/location.entity';
import { Availability } from './entities/availability.entity';
import { AvailabilityException } from './entities/availability-exception.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetAvailabilityDto, AvailabilityExceptionDto } from './dto/set-availability.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Skill) private skillRepo: Repository<Skill>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    @InjectRepository(Availability) private availRepo: Repository<Availability>,
    @InjectRepository(AvailabilityException) private exceptRepo: Repository<AvailabilityException>,
    private dataSource: DataSource,
  ) { }

  /** Lightweight list of active users for messaging / mentions — any authenticated user. */
  async directory(): Promise<Pick<User, 'id' | 'name' | 'role'>[]> {
    return this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.role'])
      .where('u.isActive = :active', { active: true })
      .orderBy('u.name', 'ASC')
      .getMany();
  }

  async findAll(requestingUser: User, locationId?: string, page = 1, limit = 50) {
    const take = Math.min(limit, 200);
    const skip = (Math.max(1, page) - 1) * take;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.skills', 'skills')
      .leftJoinAndSelect('u.certifiedLocations', 'certifiedLocations')
      .leftJoinAndSelect('u.managedLocations', 'managedLocations')
      .orderBy('u.name', 'ASC')
      .skip(skip)
      .take(take);

    if (requestingUser.role === UserRole.MANAGER) {
      qb.innerJoin('u.certifiedLocations', 'cl').where(
        'cl.id IN (:...locationIds)',
        { locationIds: requestingUser.managedLocations?.map((l) => l.id) ?? ['__none__'] },
      );
    }

    if (locationId) {
      qb.andWhere('certifiedLocations.id = :locationId', { locationId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: Math.max(1, page), limit: take };
  }

  async findOne(id: string, requester?: User) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['skills', 'certifiedLocations', 'managedLocations', 'availabilities', 'availabilityExceptions'],
    });
    if (!user) throw new NotFoundException('User not found');

    // Staff can only see their own sensitive fields; strip hourlyRate from others' profiles
    if (requester && requester.role === UserRole.STAFF && requester.id !== id) {
      user.hourlyRate = null;
      user.notificationPreferences = null;
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, requestingUser: User) {
    const user = await this.findOne(id);

    if (requestingUser.role !== UserRole.ADMIN && requestingUser.id !== id) {
      throw new ForbiddenException();
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.isActive !== undefined && requestingUser.role === UserRole.ADMIN) {
      user.isActive = dto.isActive;
    }
    if (dto.desiredHoursPerWeek !== undefined) user.desiredHoursPerWeek = dto.desiredHoursPerWeek;
    if (dto.hourlyRate !== undefined) user.hourlyRate = dto.hourlyRate ?? null;
    if (dto.notificationPreferences !== undefined) {
      user.notificationPreferences = dto.notificationPreferences;
    }
    if (dto.role !== undefined && requestingUser.role === UserRole.ADMIN) {
      user.role = dto.role;
      // A non-manager should never retain managed locations — clear them on demotion.
      if (dto.role !== UserRole.MANAGER) {
        user.managedLocations = [];
      }
    }

    if (dto.skillIds !== undefined) {
      user.skills = await this.skillRepo.findBy({ id: In(dto.skillIds) });
    }
    if (dto.certifiedLocationIds !== undefined) {
      user.certifiedLocations = await this.locationRepo.findBy({ id: In(dto.certifiedLocationIds) });
    }
    if (dto.managedLocationIds !== undefined && requestingUser.role === UserRole.ADMIN) {
      user.managedLocations = await this.locationRepo.findBy({ id: In(dto.managedLocationIds) });
    }

    return this.userRepo.save(user);
  }

  async resetPassword(id: string, newPassword: string, requestingUser: User) {
    if (requestingUser.role !== UserRole.ADMIN) throw new ForbiddenException();
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.password = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);
    return { message: 'Password reset successfully' };
  }

  async changePassword(id: string, currentPassword: string, newPassword: string, requestingUser: User) {
    if (requestingUser.role !== UserRole.ADMIN && requestingUser.id !== id) {
      throw new ForbiddenException();
    }

    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    user.password = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);
    return { message: 'Password updated successfully' };
  }

  async getAvailability(userId: string) {
    const slots = await this.availRepo.find({ where: { userId }, order: { dayOfWeek: 'ASC' } });
    const exceptions = await this.exceptRepo.find({
      where: { userId },
      order: { date: 'ASC' },
    });
    return { slots, exceptions };
  }

  async setAvailability(userId: string, dto: SetAvailabilityDto, requestingUserId: string) {
    if (userId !== requestingUserId) {
      const requester = await this.userRepo.findOne({ where: { id: requestingUserId } });
      if (requester?.role !== UserRole.ADMIN) throw new ForbiddenException();
    }

    return this.dataSource.transaction(async (em) => {
      await em.delete(Availability, { userId });
      const slots = dto.slots.map((s) => em.create(Availability, { userId, ...s }));
      return em.save(Availability, slots);
    });
  }

  async addAvailabilityException(userId: string, dto: AvailabilityExceptionDto, requestingUserId: string) {
    if (userId !== requestingUserId) {
      const requester = await this.userRepo.findOne({ where: { id: requestingUserId } });
      if (requester?.role !== UserRole.ADMIN) throw new ForbiddenException();
    }
    const ex = this.exceptRepo.create({
      userId,
      date: dto.date,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      isUnavailable: dto.isUnavailable ?? false,
    });
    return this.exceptRepo.save(ex);
  }

  async removeAvailabilityException(exceptionId: string, requestingUserId: string) {
    const ex = await this.exceptRepo.findOne({ where: { id: exceptionId } });
    if (!ex) throw new NotFoundException();
    if (ex.userId !== requestingUserId) {
      const requester = await this.userRepo.findOne({ where: { id: requestingUserId } });
      if (requester?.role !== UserRole.ADMIN) throw new ForbiddenException();
    }
    return this.exceptRepo.remove(ex);
  }

  /** Return all staff who are qualified and available for a shift (used for "suggest alternatives") */
  async findQualifiedForShift(skillId: string | null, locationId: string, excludeUserIds: string[] = []) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.certifiedLocations', 'cl', 'cl.id = :locationId', { locationId })
      .leftJoinAndSelect('u.skills', 'skills')
      .where('u.isActive = true AND u.role = :role', { role: UserRole.STAFF });

    if (skillId) {
      qb.innerJoin('u.skills', 'sk', 'sk.id = :skillId', { skillId });
    }
    if (excludeUserIds.length > 0) {
      qb.andWhere('u.id NOT IN (:...excludeIds)', { excludeIds: excludeUserIds });
    }

    return qb.getMany();
  }
}
