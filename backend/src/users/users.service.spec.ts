import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { Skill } from '../skills/entities/skill.entity';
import { Location } from '../locations/entities/location.entity';
import { Availability } from './entities/availability.entity';
import { AvailabilityException } from './entities/availability-exception.entity';

function buildQb(
  opts: { getManyAndCount?: [any[], number]; getMany?: any[] } = {},
) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
  };
}

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    name: 'Alice Thompson',
    email: 'alice@example.com',
    role: UserRole.STAFF,
    isActive: true,
    hourlyRate: null,
    notificationPreferences: { inApp: true, email: false },
    certifiedLocations: [{ id: 'loc-1' } as Location],
    managedLocations: [],
    skills: [],
    availabilities: [],
    availabilityExceptions: [],
    ...overrides,
  }) as unknown as User;

const makeAdmin = (): User =>
  ({
    id: 'admin-1',
    name: 'Sarah Chen',
    role: UserRole.ADMIN,
    managedLocations: [],
  }) as unknown as User;

const makeManager = (): User =>
  ({
    id: 'manager-1',
    name: 'Marcus Johnson',
    role: UserRole.MANAGER,
    managedLocations: [{ id: 'loc-1' } as Location],
  }) as unknown as User;

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<any>;
  let skillRepo: jest.Mocked<any>;
  let locationRepo: jest.Mocked<any>;
  let availRepo: jest.Mocked<any>;
  let exceptRepo: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    skillRepo = { findBy: jest.fn().mockResolvedValue([]) };
    locationRepo = { findBy: jest.fn().mockResolvedValue([]) };
    availRepo = { find: jest.fn().mockResolvedValue([]) };
    exceptRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Location), useValue: locationRepo },
        { provide: getRepositoryToken(Availability), useValue: availRepo },
        {
          provide: getRepositoryToken(AvailabilityException),
          useValue: exceptRepo,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('strips hourlyRate for staff viewing another user', async () => {
      const target = makeUser({ id: 'other-1', hourlyRate: 25 as any });
      userRepo.findOne.mockResolvedValue(target);
      const viewer = makeUser({ id: 'staff-viewer' });

      const result = await service.findOne('other-1', viewer);
      expect(result.hourlyRate).toBeNull();
    });

    it('preserves hourlyRate for admin', async () => {
      const target = makeUser({ id: 'other-1', hourlyRate: 25 as any });
      userRepo.findOne.mockResolvedValue(target);
      const result = await service.findOne('other-1', makeAdmin());
      expect(result.hourlyRate).toBe(25);
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when non-admin tries to update another user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const otherStaff = makeUser({ id: 'staff-99' });
      await expect(service.update('user-1', {}, otherStaff)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows user to update their own profile', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((u: any) => Promise.resolve(u));

      const result = await service.update(
        'user-1',
        { name: 'Alice Updated' },
        user,
      );
      expect(result.name).toBe('Alice Updated');
    });

    it('only admin can update role and isActive', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((u: any) => Promise.resolve(u));

      const admin = makeAdmin();
      const result = await service.update(
        'user-1',
        { role: UserRole.MANAGER, isActive: false },
        admin,
      );
      expect(result.role).toBe(UserRole.MANAGER);
      expect(result.isActive).toBe(false);
    });

    it('clears managedLocations when user is demoted from manager', async () => {
      const user = makeUser({
        role: UserRole.MANAGER,
        managedLocations: [{ id: 'loc-1' } as Location],
      });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((u: any) => Promise.resolve(u));
      const admin = makeAdmin();

      const result = await service.update(
        'user-1',
        { role: UserRole.STAFF },
        admin,
      );
      expect(result.managedLocations).toEqual([]);
    });
  });

  describe('resetPassword', () => {
    it('throws ForbiddenException for non-admin', async () => {
      const user = makeUser();
      await expect(
        service.resetPassword('user-1', 'newpass', user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('hashes and saves new password for admin', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      userRepo.save.mockImplementation((u: any) => Promise.resolve(u));
      const result = await service.resetPassword(
        'user-1',
        'newpass123',
        makeAdmin(),
      );
      expect(result.message).toContain('Password reset');
    });
  });

  describe('changePassword', () => {
    it("throws ForbiddenException when changing another user's password", async () => {
      const requester = makeUser({ id: 'staff-99' });
      await expect(
        service.changePassword('user-1', 'old', 'new', requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when current password is wrong', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ ...makeUser(), password: hashed }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const user = makeUser();
      await expect(
        service.changePassword('user-1', 'wrong', 'new', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password when current password is correct', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ ...makeUser(), password: hashed }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      userRepo.save.mockImplementation((u: any) => Promise.resolve(u));

      const result = await service.changePassword(
        'user-1',
        'correct',
        'newpass',
        makeUser(),
      );
      expect(result.message).toContain('Password updated');
    });
  });

  describe('setAvailability', () => {
    it('replaces availability slots in a transaction', async () => {
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const em = {
          delete: jest.fn(),
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockResolvedValue([]),
        };
        return fn(em);
      });

      await service.setAvailability(
        'user-1',
        { slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] },
        'user-1',
      );
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it("throws ForbiddenException when non-admin changes another user's availability", async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ role: UserRole.STAFF }));
      await expect(
        service.setAvailability('user-1', { slots: [] }, 'staff-99'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeAvailabilityException', () => {
    it('throws NotFoundException when exception does not exist', async () => {
      exceptRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeAvailabilityException('ex-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-owner non-admin tries to remove', async () => {
      exceptRepo.findOne.mockResolvedValue({ id: 'ex-1', userId: 'user-1' });
      userRepo.findOne.mockResolvedValue(
        makeUser({ id: 'staff-99', role: UserRole.STAFF }),
      );
      await expect(
        service.removeAvailabilityException('ex-1', 'staff-99'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
