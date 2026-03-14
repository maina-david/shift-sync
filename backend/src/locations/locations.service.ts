import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location, FloorZoneConfig, DEFAULT_FLOOR_ZONES } from './entities/location.entity';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(@InjectRepository(Location) private locationRepo: Repository<Location>) {}

  findAll() {
    return this.locationRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const loc = await this.locationRepo.findOne({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  create(dto: CreateLocationDto) {
    return this.locationRepo.save(this.locationRepo.create(dto));
  }

  async update(id: string, dto: UpdateLocationDto) {
    const loc = await this.findOne(id);
    Object.assign(loc, dto);
    return this.locationRepo.save(loc);
  }

  async remove(id: string) {
    const loc = await this.findOne(id);
    return this.locationRepo.remove(loc);
  }

  async updateZones(id: string, zones: FloorZoneConfig[]) {
    const loc = await this.findOne(id);
    loc.zones = zones;
    return this.locationRepo.save(loc);
  }

  async resetZones(id: string) {
    const loc = await this.findOne(id);
    loc.zones = DEFAULT_FLOOR_ZONES;
    return this.locationRepo.save(loc);
  }
}
