import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { Certification } from './entities/certification.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'staff-1',
    name: 'Alice Thompson',
    role: UserRole.STAFF,
    certifiedLocations: [{ id: 'loc-1' } as Location],
    ...overrides,
  }) as unknown as User;

const makeManager = (managedLocationIds: string[] = ['loc-1']): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: managedLocationIds.map((id) => ({ id }) as Location),
  }) as unknown as User;

const makeAdmin = (): User =>
  ({
    id: 'admin-1',
    name: 'Sarah Chen',
    role: UserRole.ADMIN,
    managedLocations: [],
  }) as unknown as User;

const makeCert = (overrides: any = {}): Certification =>
  ({
    id: 'cert-1',
    userId: 'staff-1',
    name: 'Food Handler',
    issuedDate: '2024-01-01',
    expiryDate: '2026-12-31',
    documentUrl: null,
    issuer: null,
    ...overrides,
  }) as unknown as Certification;

describe('CertificationsService', () => {
  let service: CertificationsService;
  let repo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationsService,
        { provide: getRepositoryToken(Certification), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<CertificationsService>(CertificationsService);
  });

  describe('findForUser', () => {
    it('returns certs without authorization check when managedLocationIds is undefined', async () => {
      repo.find.mockResolvedValue([makeCert()]);
      const result = await service.findForUser('staff-1');
      expect(result).toHaveLength(1);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when manager has no overlap with staff locations', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ certifiedLocations: [{ id: 'loc-1' } as Location] }),
      );
      await expect(
        service.findForUser('staff-1', ['loc-other']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns certs when manager manages a location the staff is certified at', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      repo.find.mockResolvedValue([makeCert()]);
      const result = await service.findForUser('staff-1', ['loc-1']);
      expect(result).toHaveLength(1);
    });
  });

  describe('findExpiringSoon', () => {
    it('queries for certs expiring within the given days window', async () => {
      const qb = buildQb({ getMany: [makeCert()] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findExpiringSoon(30);
      expect(result).toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('expiryDate'),
        expect.any(Object),
      );
    });

    it('defaults to 30 days when no argument is provided', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findExpiringSoon();
      expect(qb.where).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Food Handler',
      issuedDate: '2024-01-01',
      expiryDate: '2026-12-31',
    };

    it('admin can create a cert for any user', async () => {
      const cert = makeCert();
      repo.create.mockReturnValue(cert);
      repo.save.mockResolvedValue(cert);
      const result = await service.create('staff-1', dto, makeAdmin());
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException when manager creates cert for staff at unmanaged location', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ certifiedLocations: [{ id: 'loc-other' } as Location] }),
      );
      const manager = makeManager(['loc-1']);
      await expect(service.create('staff-1', dto, manager)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows manager to create cert for staff at managed location', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const cert = makeCert();
      repo.create.mockReturnValue(cert);
      repo.save.mockResolvedValue(cert);

      const result = await service.create(
        'staff-1',
        dto,
        makeManager(['loc-1']),
      );
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when cert does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.remove('cert-missing', 'user-1', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('owner can remove their own cert', async () => {
      const cert = makeCert({ userId: 'staff-1' });
      repo.findOne.mockResolvedValue(cert);
      repo.remove.mockResolvedValue(cert);
      await service.remove('cert-1', 'staff-1', UserRole.STAFF);
      expect(repo.remove).toHaveBeenCalled();
    });

    it('admin can remove any cert', async () => {
      const cert = makeCert({ userId: 'staff-1' });
      repo.findOne.mockResolvedValue(cert);
      repo.remove.mockResolvedValue(cert);
      await service.remove('cert-1', 'admin-1', UserRole.ADMIN);
      expect(repo.remove).toHaveBeenCalled();
    });

    it('throws ForbiddenException when manager has no overlap with staff locations', async () => {
      const cert = makeCert({ userId: 'staff-1' });
      repo.findOne.mockResolvedValue(cert);
      userRepo.findOne.mockResolvedValue(
        makeUser({ certifiedLocations: [{ id: 'loc-1' } as Location] }),
      );
      await expect(
        service.remove('cert-1', 'manager-1', UserRole.MANAGER, ['loc-other']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-owner staff tries to remove', async () => {
      const cert = makeCert({ userId: 'staff-1' });
      repo.findOne.mockResolvedValue(cert);
      await expect(
        service.remove('cert-1', 'staff-99', UserRole.STAFF),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
