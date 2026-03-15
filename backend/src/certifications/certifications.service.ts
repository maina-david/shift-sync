import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class CertificationsService {
  constructor(
    @InjectRepository(Certification)
    private repo: Repository<Certification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findForUser(userId: string, managedLocationIds?: string[]): Promise<Certification[]> {
    if (managedLocationIds !== undefined) {
      // Manager: verify the target user is certified at one of the manager's locations
      const targetUser = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['certifiedLocations'],
      });
      const staffLocationIds = targetUser?.certifiedLocations?.map((l) => l.id) ?? [];
      const hasOverlap = staffLocationIds.some((id) => managedLocationIds.includes(id));
      if (!hasOverlap) {
        throw new ForbiddenException('You do not manage any location this staff member is certified for');
      }
    }

    return this.repo.find({
      where: { userId },
      order: { expiryDate: 'ASC' },
    });
  }

  async findExpiringSoon(daysAhead = 30): Promise<Certification[]> {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + daysAhead);

    const todayStr = today.toISOString().slice(0, 10);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return this.repo
      .createQueryBuilder('cert')
      .leftJoinAndSelect('cert.user', 'user')
      .where('cert.expiryDate >= :today', { today: todayStr })
      .andWhere('cert.expiryDate <= :cutoff', { cutoff: cutoffStr })
      .orderBy('cert.expiryDate', 'ASC')
      .getMany();
  }

  async create(userId: string, dto: CreateCertificationDto, requester: User): Promise<Certification> {
    if (requester.role === UserRole.MANAGER) {
      const targetUser = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['certifiedLocations'],
      });
      const staffLocationIds = targetUser?.certifiedLocations?.map((l) => l.id) ?? [];
      const managedIds = requester.managedLocations?.map((l) => l.id) ?? [];
      const hasOverlap = staffLocationIds.some((id) => managedIds.includes(id));
      if (!hasOverlap) {
        throw new ForbiddenException('You do not manage any location this staff member is certified for');
      }
    }

    if (dto.expiryDate && new Date(dto.expiryDate) < new Date(dto.issuedDate)) {
      throw new BadRequestException('Expiry date must be on or after issued date');
    }

    const cert = this.repo.create({
      userId,
      name: dto.name,
      issuedDate: dto.issuedDate,
      expiryDate: dto.expiryDate,
      documentUrl: dto.documentUrl ?? null,
      issuer: dto.issuer ?? null,
    });
    return this.repo.save(cert);
  }

  async remove(
    id: string,
    requesterId: string,
    requesterRole: UserRole,
    managerLocationIds?: string[],
  ): Promise<Certification> {
    const cert = await this.repo.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certification not found');

    const isOwner = cert.userId === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      if (requesterRole === UserRole.MANAGER) {
        const certUser = await this.userRepo.findOne({
          where: { id: cert.userId },
          relations: ['certifiedLocations'],
        });
        const staffLocationIds = certUser?.certifiedLocations?.map((l) => l.id) ?? [];
        const hasOverlap = staffLocationIds.some((lid) => (managerLocationIds ?? []).includes(lid));
        if (!hasOverlap) {
          throw new ForbiddenException('You do not manage any location this staff member is certified for');
        }
      } else {
        throw new ForbiddenException('Only the cert owner, a manager, or an admin can delete this certification');
      }
    }

    const snapshot = { ...cert };
    await this.repo.remove(cert);
    return snapshot as Certification;
  }

  async getExpiredForUser(userId: string): Promise<Certification[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.repo
      .createQueryBuilder('cert')
      .where('cert.userId = :userId', { userId })
      .andWhere('cert.expiryDate < :today', { today })
      .orderBy('cert.expiryDate', 'ASC')
      .getMany();
  }
}
