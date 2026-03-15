import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';

const makeSkill = (overrides: any = {}): Skill =>
  ({ id: 'skill-1', name: 'Barista', ...overrides } as unknown as Skill);

describe('SkillsService', () => {
  let service: SkillsService;
  let repo: jest.Mocked<any>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: getRepositoryToken(Skill), useValue: repo },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  describe('findAll', () => {
    it('returns all skills ordered by name', async () => {
      repo.find.mockResolvedValue([makeSkill()]);
      const result = await service.findAll();
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { name: 'ASC' } }));
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when skill does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns skill when found', async () => {
      repo.findOne.mockResolvedValue(makeSkill());
      const result = await service.findOne('skill-1');
      expect(result.id).toBe('skill-1');
    });
  });

  describe('create', () => {
    it('creates and saves a skill', async () => {
      const skill = makeSkill();
      repo.create.mockReturnValue(skill);
      repo.save.mockResolvedValue(skill);
      const result = await service.create({ name: 'Barista' });
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe('Barista');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when skill does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes and returns the skill', async () => {
      const skill = makeSkill();
      repo.findOne.mockResolvedValue(skill);
      repo.remove.mockResolvedValue(skill);
      const result = await service.remove('skill-1');
      expect(repo.remove).toHaveBeenCalledWith(skill);
    });
  });
});
