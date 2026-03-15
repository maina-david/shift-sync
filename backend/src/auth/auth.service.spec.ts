import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

const makeUser = (overrides: Partial<User & { password: string }> = {}): User =>
  ({
    id: 'user-1',
    name: 'Alice Thompson',
    email: 'alice@example.com',
    role: UserRole.STAFF,
    isActive: true,
    refreshTokenHash: null,
    notificationPreferences: { inApp: true, email: false },
    ...overrides,
  } as unknown as User);

const makeMockRes = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<any>;
  let jwtService: jest.Mocked<any>;
  let config: jest.Mocked<any>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };
    config = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email is already registered', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.register({ name: 'Alice', email: 'alice@example.com', password: 'pass', role: UserRole.STAFF }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and saves user on success', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const created = makeUser({ password: 'hashed' });
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue({ ...created, password: 'hashed' });

      const result = await service.register({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'plaintext',
        role: UserRole.STAFF,
      });

      expect(userRepo.save).toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });

    it('strips password from returned object', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const created = makeUser();
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue({ ...created, password: 'hashed' });

      const result = await service.register({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret',
        role: UserRole.STAFF,
      });
      expect((result as any).password).toBeUndefined();
    });
  });

  describe('validateUser', () => {
    it('returns null when user is not found', async () => {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validateUser('nobody@example.com', 'pass');
      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...makeUser(), password: hashed }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validateUser('alice@example.com', 'wrong');
      expect(result).toBeNull();
    });

    it('returns user without password when credentials are correct', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...makeUser(), password: hashed }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validateUser('alice@example.com', 'correct');
      expect(result).not.toBeNull();
      expect((result as any).password).toBeUndefined();
    });
  });

  describe('login', () => {
    it('signs tokens, stores hash, sets cookie, and returns accessToken', async () => {
      const user = makeUser();
      const res = makeMockRes();
      jwtService.sign.mockReturnValue('access-token');

      const result = await service.login(user as any, res as any);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(userRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ refreshTokenHash: expect.any(String) }),
      );
      expect(res.cookie).toHaveBeenCalled();
      expect(result.token).toBe('access-token');
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when JWT verification fails', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('expired'); });
      const res = makeMockRes();
      await expect(service.refresh('bad-token', res as any)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      const res = makeMockRes();
      await expect(service.refresh('token', res as any)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when stored hash does not match', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      const storedHash = sha256('other-token');
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...makeUser(), refreshTokenHash: storedHash }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      const res = makeMockRes();
      await expect(service.refresh('wrong-token', res as any)).rejects.toThrow(UnauthorizedException);
    });

    it('rotates token and returns new access token on success', async () => {
      const refreshToken = 'valid-refresh-token';
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      jwtService.sign.mockReturnValue('new-access-token');
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...makeUser(), refreshTokenHash: sha256(refreshToken) }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      const res = makeMockRes();

      const result = await service.refresh(refreshToken, res as any);
      expect(result.token).toBe('new-access-token');
      expect(userRepo.update).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears refreshTokenHash and cookie when userId is provided', async () => {
      const res = makeMockRes();
      await service.logout(res as any, 'user-1');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', { refreshTokenHash: null });
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it('only clears cookie when userId is not provided', async () => {
      const res = makeMockRes();
      await service.logout(res as any);
      expect(userRepo.update).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  describe('profile', () => {
    it('returns user with relations', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      const result = await service.profile('user-1');
      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(result).toBe(user);
    });
  });
});
