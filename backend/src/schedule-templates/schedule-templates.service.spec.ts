import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { ScheduleTemplate } from './entities/schedule-template.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';

const makeTemplate = (overrides: any = {}): ScheduleTemplate =>
  ({
    id: 'tmpl-1',
    name: 'Standard Week',
    locationId: 'loc-1',
    shifts: [
      { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', headcount: 2, requiredSkillId: null, notes: null },
      { dayOfWeek: 3, startTime: '12:00', endTime: '20:00', headcount: 1, requiredSkillId: null, notes: null },
    ],
    createdById: 'manager-1',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as unknown as ScheduleTemplate);

const makeShift = (overrides: any = {}): Shift =>
  ({
    id: `shift-${Math.random()}`,
    locationId: 'loc-1',
    date: '2026-03-16',
    startTime: '09:00',
    endTime: '17:00',
    status: ShiftStatus.DRAFT,
    headcount: 2,
    ...overrides,
  } as unknown as Shift);

describe('ScheduleTemplatesService', () => {
  let service: ScheduleTemplatesService;
  let templatesRepo: jest.Mocked<any>;
  let shiftsRepo: jest.Mocked<any>;

  beforeEach(async () => {
    templatesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    shiftsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleTemplatesService,
        { provide: getRepositoryToken(ScheduleTemplate), useValue: templatesRepo },
        { provide: getRepositoryToken(Shift), useValue: shiftsRepo },
      ],
    }).compile();

    service = module.get<ScheduleTemplatesService>(ScheduleTemplatesService);
  });

  describe('findAll', () => {
    it('returns all templates when no locationId provided', async () => {
      templatesRepo.find.mockResolvedValue([makeTemplate()]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('filters by locationId when provided', async () => {
      templatesRepo.find.mockResolvedValue([makeTemplate()]);
      await service.findAll('loc-1');
      expect(templatesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { locationId: 'loc-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when template does not exist', async () => {
      templatesRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns template when found', async () => {
      templatesRepo.findOne.mockResolvedValue(makeTemplate());
      const result = await service.findOne('tmpl-1');
      expect(result.id).toBe('tmpl-1');
    });
  });

  describe('create', () => {
    it('creates and saves a template with mapped shifts', async () => {
      const tmpl = makeTemplate();
      templatesRepo.create.mockReturnValue(tmpl);
      templatesRepo.save.mockResolvedValue(tmpl);

      const result = await service.create(
        {
          name: 'Standard Week',
          locationId: 'loc-1',
          shifts: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', headcount: 2 }],
        } as any,
        'manager-1',
      );
      expect(result.id).toBe('tmpl-1');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when template does not exist', async () => {
      templatesRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes template when found', async () => {
      const tmpl = makeTemplate();
      templatesRepo.findOne.mockResolvedValue(tmpl);
      templatesRepo.remove.mockResolvedValue(undefined);
      await service.remove('tmpl-1');
      expect(templatesRepo.remove).toHaveBeenCalledWith(tmpl);
    });
  });

  describe('apply', () => {
    it('throws NotFoundException when template does not exist', async () => {
      templatesRepo.findOne.mockResolvedValue(null);
      await expect(service.apply('missing', '2026-03-16', 'manager-1')).rejects.toThrow(NotFoundException);
    });

    it('creates a shift for each template slot with correct dates', async () => {
      templatesRepo.findOne.mockResolvedValue(makeTemplate());
      const shift1 = makeShift({ id: 'shift-new-1' });
      const shift2 = makeShift({ id: 'shift-new-2' });
      shiftsRepo.create.mockReturnValueOnce(shift1).mockReturnValueOnce(shift2);
      shiftsRepo.save.mockResolvedValue([shift1, shift2]);

      const result = await service.apply('tmpl-1', '2026-03-16', 'manager-1');
      expect(result.shiftIds).toHaveLength(2);
    });

    it('sets status to DRAFT on all applied shifts', async () => {
      const template = makeTemplate({
        shifts: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', headcount: 1, requiredSkillId: null }],
      });
      templatesRepo.findOne.mockResolvedValue(template);
      const shift = makeShift({ id: 'shift-new-1', status: ShiftStatus.DRAFT });
      shiftsRepo.create.mockReturnValue(shift);
      shiftsRepo.save.mockResolvedValue([shift]);

      await service.apply('tmpl-1', '2026-03-16', 'manager-1');
      expect(shiftsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ShiftStatus.DRAFT }),
      );
    });
  });
});
