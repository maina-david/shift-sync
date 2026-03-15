import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './entities/bookmark.entity';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';

@Injectable()
export class BookmarksService {
  constructor(@InjectRepository(Bookmark) private repo: Repository<Bookmark>) {}

  findAll(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  create(dto: CreateBookmarkDto, userId: string) {
    const bookmark = this.repo.create({ ...dto, userId });
    return this.repo.save(bookmark);
  }

  async remove(id: string, userId: string) {
    const bookmark = await this.repo.findOne({ where: { id, userId } });
    if (!bookmark) throw new NotFoundException('Bookmark not found');
    const snapshot = { ...bookmark };
    await this.repo.remove(bookmark);
    return snapshot;
  }
}
