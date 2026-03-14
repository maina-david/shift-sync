import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from './entities/skill.entity';
import { CreateSkillDto } from './dto/create-skill.dto';

@Injectable()
export class SkillsService {
  constructor(@InjectRepository(Skill) private skillRepo: Repository<Skill>) {}

  findAll() { return this.skillRepo.find({ order: { name: 'ASC' } }); }

  async findOne(id: string) {
    const skill = await this.skillRepo.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  create(dto: CreateSkillDto) { return this.skillRepo.save(this.skillRepo.create(dto)); }

  async remove(id: string) {
    const skill = await this.findOne(id);
    return this.skillRepo.remove(skill);
  }
}
