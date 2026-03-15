import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ShiftFeedbackService } from './shift-feedback.service';
import { ShiftFeedback } from './entities/shift-feedback.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';

function buildQb(opts: { getMany?: any[] } = {}) {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.getMany ?? []),
  };
}

const makeFeedback = (overrides: any = {}): ShiftFeedback =>
  ({
    id: 'fb-1',
    staffId: 'staff-1',
    assignmentId: 'assign-1',
    rating: 4,
    comment: 'Good shift',
    adequatelyStaffed: true,
    wouldRepeat: true,
    ...overrides,
  } as unknown as ShiftFeedback);

const makeAssignment = (staffId = 'staff-1'): ShiftAssignment =>
  ({
    id: 'assign-1',
    staffId,
    shift: { id: 'shift-1', locationId: 'loc-1' },
  } as unknown as ShiftAssignment);

describe('ShiftFeedbackService', () => {
  let service: ShiftFeedbackService;
  let repo: jest.Mocked<any>;
  let assignmentRepo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    assignmentRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftFeedbackService,
        { provide: getRepositoryToken(ShiftFeedback), useValue: repo },
        { provide: getRepositoryToken(ShiftAssignment), useValue: assignmentRepo },
      ],
    }).compile();

    service = module.get<ShiftFeedbackService>(ShiftFeedbackService);
  });

  describe('submit', () => {
    it('throws NotFoundException when assignment does not exist', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.submit('staff-1', { assignmentId: 'missing', rating: 4 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when submitting for another staff member\'s assignment', async () => {
      assignmentRepo.findOne.mockResolvedValue(makeAssignment('staff-2'));
      await expect(
        service.submit('staff-1', { assignmentId: 'assign-1', rating: 4 } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when feedback already exists', async () => {
      assignmentRepo.findOne.mockResolvedValue(makeAssignment('staff-1'));
      repo.findOne.mockResolvedValue(makeFeedback());
      await expect(
        service.submit('staff-1', { assignmentId: 'assign-1', rating: 4 } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates and saves feedback on success', async () => {
      assignmentRepo.findOne.mockResolvedValue(makeAssignment('staff-1'));
      repo.findOne.mockResolvedValue(null);
      const fb = makeFeedback();
      repo.create.mockReturnValue(fb);
      repo.save.mockResolvedValue(fb);

      const result = await service.submit('staff-1', {
        assignmentId: 'assign-1',
        rating: 4,
        adequatelyStaffed: true,
        wouldRepeat: true,
      } as any);
      expect(result.rating).toBe(4);
    });
  });

  describe('getSummary', () => {
    it('returns null stats when no feedback exists', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.totalResponses).toBe(0);
      expect(result.averageRating).toBeNull();
    });

    it('calculates correct averageRating', async () => {
      const qb = buildQb({
        getMany: [
          { rating: 4, adequatelyStaffed: true, wouldRepeat: true },
          { rating: 2, adequatelyStaffed: false, wouldRepeat: false },
        ],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.averageRating).toBe(3);
      expect(result.totalResponses).toBe(2);
    });

    it('calculates pctAdequatelyStaffed correctly', async () => {
      const qb = buildQb({
        getMany: [
          { rating: 5, adequatelyStaffed: true, wouldRepeat: true },
          { rating: 3, adequatelyStaffed: false, wouldRepeat: null },
          { rating: 4, adequatelyStaffed: true, wouldRepeat: true },
        ],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.pctAdequatelyStaffed).toBe(66.7);
    });

    it('returns null pctAdequatelyStaffed when all values are null', async () => {
      const qb = buildQb({
        getMany: [{ rating: 4, adequatelyStaffed: null, wouldRepeat: null }],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSummary();
      expect(result.pctAdequatelyStaffed).toBeNull();
    });

    it('applies managedLocationIds sentinel when empty', async () => {
      const qb = buildQb({ getMany: [] });
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.getSummary(undefined, undefined, undefined, []);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('managedIds'),
        expect.objectContaining({ managedIds: ['__none__'] }),
      );
    });
  });

  describe('getMyFeedback', () => {
    it('returns feedback for the given staff member', async () => {
      repo.find.mockResolvedValue([makeFeedback()]);
      const result = await service.getMyFeedback('staff-1');
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { staffId: 'staff-1' } }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
