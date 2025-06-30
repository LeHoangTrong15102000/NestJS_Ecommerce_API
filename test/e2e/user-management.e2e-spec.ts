import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase, createTestUser } from '../helpers/test-helpers'
import { HashingService } from '../../src/shared/services/hashing.service'
import { TokenService } from '../../src/shared/services/token.service'

describe('User Management E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    hashingService = moduleFixture.get<HashingService>(HashingService)
    tokenService = moduleFixture.get<TokenService>(TokenService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('User CRUD Operations', () => {
    let adminToken: string
    let clientToken: string
    let adminUserId: number
    let clientUserId: number

    beforeEach(async () => {
      // Create admin user
      const adminTestUser = await createTestUser(prisma, tokenService, hashingService, {
        email: 'admin@test.com',
        name: 'Admin User',
        roleId: 1, // Admin role
      })
      adminToken = adminTestUser.accessToken
      adminUserId = adminTestUser.user.id

      // Create client user
      const clientTestUser = await createTestUser(prisma, tokenService, hashingService, {
        email: 'client@test.com',
        name: 'Client User',
        roleId: 2, // Client role
      })
      clientToken = clientTestUser.accessToken
      clientUserId = clientTestUser.user.id
    })

    describe('GET /users - List Users', () => {
      it('should return paginated users list for admin', async () => {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({
            page: 1,
            limit: 10,
          })
          .expect(200)

        expect(response.body).toMatchObject({
          data: expect.any(Array),
          meta: {
            page: 1,
            limit: 10,
            total: expect.any(Number),
            totalPages: expect.any(Number),
          },
        })

        expect(response.body.data.length).toBeGreaterThan(0)
        expect(response.body.data[0]).toMatchObject({
          id: expect.any(Number),
          email: expect.any(String),
          name: expect.any(String),
          phoneNumber: expect.any(String),
          status: expect.any(String),
          role: expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
          }),
        })

        // Should not expose password
        expect(response.body.data[0].password).toBeUndefined()
      })

      it('should reject unauthorized access for client', async () => {
        await request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${clientToken}`).expect(403)
      })

      it('should reject access without token', async () => {
        await request(app.getHttpServer()).get('/users').expect(401)
      })
    })

    describe('GET /users/:id - Get User by ID', () => {
      it('should return user details for admin', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${clientUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        expect(response.body).toMatchObject({
          id: clientUserId,
          email: 'client@test.com',
          name: 'Client User',
          role: expect.objectContaining({
            name: 'CLIENT',
            permissions: expect.any(Array),
          }),
        })
      })

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer()).get('/users/999999').set('Authorization', `Bearer ${adminToken}`).expect(404)
      })
    })

    describe('POST /users - Create User', () => {
      const newUserData = {
        email: 'newuser@test.com',
        name: 'New User',
        phoneNumber: '0987654321',
        password: 'password123',
        roleId: 2,
      }

      it('should create user successfully for admin', async () => {
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newUserData)
          .expect(201)

        expect(response.body).toMatchObject({
          id: expect.any(Number),
          email: newUserData.email,
          name: newUserData.name,
          phoneNumber: newUserData.phoneNumber,
          status: 'INACTIVE',
        })

        // Verify user is created in database
        const createdUser = await prisma.user.findFirst({
          where: { email: newUserData.email },
        })

        expect(createdUser).toBeDefined()
        expect(createdUser?.password).not.toBe(newUserData.password) // Should be hashed
      })

      it('should reject duplicate email', async () => {
        // Create first user
        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newUserData)
          .expect(201)

        // Try to create user with same email
        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newUserData)
          .expect(400)

        expect(response.body.message).toContain('Email đã tồn tại')
      })

      it('should validate required fields', async () => {
        const invalidData = {
          email: 'invalid-email', // Invalid email format
          name: '', // Empty name
          phoneNumber: '123', // Too short
          password: '123', // Too short
          roleId: 999, // Non-existent role
        }

        const response = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400)

        expect(response.body.message).toEqual(expect.any(Array))
      })

      it('should reject client creating admin user', async () => {
        const adminUserData = {
          ...newUserData,
          email: 'newadmin@test.com',
          roleId: 1, // Admin role
        }

        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${clientToken}`)
          .send(adminUserData)
          .expect(403)
      })
    })

    describe('PUT /users/:id - Update User', () => {
      let targetUserId: number

      beforeEach(async () => {
        const targetUser = await prisma.user.create({
          data: {
            email: 'target@test.com',
            name: 'Target User',
            phoneNumber: '0111111111',
            password: 'hashedPassword',
            roleId: 2,
            status: 'ACTIVE',
          },
        })
        targetUserId = targetUser.id
      })

      it('should update user successfully for admin', async () => {
        const updateData = {
          name: 'Updated Name',
          phoneNumber: '0999999999',
        }

        const response = await request(app.getHttpServer())
          .put(`/users/${targetUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200)

        expect(response.body).toMatchObject({
          id: targetUserId,
          name: updateData.name,
          phoneNumber: updateData.phoneNumber,
        })

        // Verify update in database
        const updatedUser = await prisma.user.findUnique({
          where: { id: targetUserId },
        })

        expect(updatedUser?.name).toBe(updateData.name)
        expect(updatedUser?.phoneNumber).toBe(updateData.phoneNumber)
      })

      it('should prevent user from updating themselves', async () => {
        const updateData = {
          name: 'Self Update',
        }

        await request(app.getHttpServer())
          .put(`/users/${adminUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(400)
      })

      it('should prevent client from updating admin user', async () => {
        const updateData = {
          name: 'Hacked Admin',
        }

        await request(app.getHttpServer())
          .put(`/users/${adminUserId}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .send(updateData)
          .expect(403)
      })
    })

    describe('DELETE /users/:id - Delete User', () => {
      let targetUserId: number

      beforeEach(async () => {
        const targetUser = await prisma.user.create({
          data: {
            email: 'tobedeleted@test.com',
            name: 'To Be Deleted',
            phoneNumber: '0111111111',
            password: 'hashedPassword',
            roleId: 2,
            status: 'ACTIVE',
          },
        })
        targetUserId = targetUser.id
      })

      it('should soft delete user successfully for admin', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/users/${targetUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        expect(response.body.message).toContain('deleted successfully')

        // Verify soft delete in database
        const deletedUser = await prisma.user.findUnique({
          where: { id: targetUserId },
        })

        expect(deletedUser?.deletedAt).not.toBeNull()
        expect(deletedUser?.deletedById).toBe(adminUserId)
      })

      it('should prevent user from deleting themselves', async () => {
        await request(app.getHttpServer())
          .delete(`/users/${adminUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400)
      })

      it('should prevent client from deleting admin user', async () => {
        await request(app.getHttpServer())
          .delete(`/users/${adminUserId}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(403)
      })
    })
  })

  describe('User Search and Filtering', () => {
    let adminToken: string

    beforeEach(async () => {
      const adminTestUser = await createTestUser(prisma, tokenService, hashingService, {
        email: 'admin@test.com',
        roleId: 1,
      })
      adminToken = adminTestUser.accessToken

      // Create multiple test users for filtering
      await prisma.user.createMany({
        data: [
          {
            email: 'john@test.com',
            name: 'John Doe',
            phoneNumber: '0111111111',
            password: 'hashedPassword',
            roleId: 2,
            status: 'ACTIVE',
          },
          {
            email: 'jane@test.com',
            name: 'Jane Smith',
            phoneNumber: '0222222222',
            password: 'hashedPassword',
            roleId: 2,
            status: 'INACTIVE',
          },
          {
            email: 'bob@test.com',
            name: 'Bob Johnson',
            phoneNumber: '0333333333',
            password: 'hashedPassword',
            roleId: 1,
            status: 'ACTIVE',
          },
        ],
      })
    })

    it('should filter users by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          status: 'ACTIVE',
        })
        .expect(200)

      expect(response.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'ACTIVE' })]))

      // Should not contain INACTIVE users
      const inactiveUsers = response.body.data.filter((user: any) => user.status === 'INACTIVE')
      expect(inactiveUsers).toHaveLength(0)
    })

    it('should search users by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          search: 'John',
        })
        .expect(200)

      expect(response.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining('John') })]),
      )
    })

    it('should filter users by role', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          roleId: 1, // Admin role
        })
        .expect(200)

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: expect.objectContaining({ id: 1 }),
          }),
        ]),
      )
    })
  })
})
