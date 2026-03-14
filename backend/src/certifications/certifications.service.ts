import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CertificationsService {
  constructor(
    @InjectRepository(Certification)
    private repo: Repository<Certification>,
  ) {}

  findForUser(userId: string): Promise<Certification[]> {
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

  create(userId: string, dto: CreateCertificationDto): Promise<Certification> {
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
  ): Promise<Certification> {
    const cert = await this.repo.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certification not found');

    const isOwner = cert.userId === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;
    const isManager = requesterRole === UserRole.MANAGER;

    if (!isOwner && !isAdmin && !isManager) {
      throw new ForbiddenException(
        'Only the cert owner, a manager, or an admin can delete this certification',
      );
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
