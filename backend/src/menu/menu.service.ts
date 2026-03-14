import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Or, Equal } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(@InjectRepository(MenuItem) private repo: Repository<MenuItem>) {}

  findAll(locationId?: string) {
    const where: any = { isAvailable: true };
    if (locationId) where.locationId = Or(IsNull(), Equal(locationId));
    else where.locationId = IsNull();
    return this.repo.find({ where, order: { sortOrder: 'ASC', name: 'ASC' }, relations: ['location'] });
  }

  findHighlights(locationId?: string) {
    const where: any = { isAvailable: true, isTodaysHighlight: true };
    if (locationId) where.locationId = Or(IsNull(), Equal(locationId));
    else where.locationId = IsNull();
    return this.repo.find({ where, order: { sortOrder: 'ASC' }, relations: ['location'] });
  }

  findAllAdmin(locationId?: string) {
    const where: any = locationId ? { locationId: Or(IsNull(), Equal(locationId)) } : {};
    return this.repo.find({ where: Object.keys(where).length ? where : undefined, order: { sortOrder: 'ASC', name: 'ASC' }, relations: ['location'] });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  create(dto: CreateMenuItemDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateMenuItemDto) {
    const item = await this.findOne(id);
    return this.repo.save({ ...item, ...dto });
  }

  async toggleHighlight(id: string) {
    const item = await this.findOne(id);
    return this.repo.save({ ...item, isTodaysHighlight: !item.isTodaysHighlight });
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    return this.repo.remove(item);
  }
}
