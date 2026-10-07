import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../auth/phone';
import { CreateStudentDto } from './dto/create-student.dto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, classId?: string, isActive?: boolean) {
    return this.prisma.student.findMany({
      where: {
        schoolId,
        isActive: isActive ?? true,
        ...(classId
          ? { enrollments: { some: { classId } } }
          : {}),
      },
      include: {
        enrollments: {
          include: { class: { select: { id: true, name: true } }, academicYear: true },
        },
        parents: {
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string, parentUserId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        enrollments: {
          include: {
            class: {
              include: {
                level: { select: { id: true, name: true } },
                instructions: { orderBy: { sortOrder: 'asc' } },
                teachers: {
                  include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
                },
              },
            },
            academicYear: true,
          },
          orderBy: { academicYear: { startsOn: 'desc' } },
        },
        parents: {
          include: {
            user: { select: { id: true, fullName: true, email: true, avatarUrl: true, phone: true } },
          },
        },
        dailyReports: {
          orderBy: { reportDate: 'desc' },
          take: 10,
          include: { media: true, teacher: { select: { id: true, fullName: true } } },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: { payments: true },
        },
        activityRegistrations: {
          where: { status: { not: 'cancelled' } },
          include: {
            activity: {
              select: { id: true, title: true, activityType: true, monthlyCost: true, oneTimeCost: true, startsOn: true, endsOn: true },
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
        studentServices: {
          where: { isActive: true },
          include: {
            service: { select: { id: true, name: true, serviceType: true, monthlyCost: true, pickupCost: true, dropoffCost: true } },
            route: { select: { id: true, name: true } },
            stop: { select: { id: true, name: true, address: true, pickupTime: true, dropoffTime: true } },
          },
        },
        eventEnrollments: {
          include: {
            event: {
              select: {
                id: true, title: true, description: true, eventType: true, eventDate: true,
                costPerChild: true, status: true, mediaUrls: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (parentUserId && !student.parents.some((p) => p.userId === parentUserId)) {
      throw new ForbiddenException('Μπορείτε να δείτε μόνο τα δικά σας παιδιά.');
    }

    // Find siblings: shared parents + explicit links
    const parentUserIds = student.parents.map((p) => p.userId);
    const [parentSiblings, explicitSiblings] = await Promise.all([
      parentUserIds.length
        ? this.prisma.student.findMany({
            where: {
              schoolId,
              id: { not: id },
              isActive: true,
              parents: { some: { userId: { in: parentUserIds } } },
            },
            select: { id: true, fullName: true, dob: true, avatarUrl: true },
          })
        : Promise.resolve([]),
      this.getSiblings(id, schoolId),
    ]);
    // Merge and deduplicate by id
    const siblingMap = new Map<string, any>();
    [...parentSiblings, ...explicitSiblings].forEach(s => siblingMap.set(s.id, s));

    return { ...student, siblings: Array.from(siblingMap.values()) };
  }

  async findByParent(parentUserId: string, schoolId: string) {
    return this.prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        parents: { some: { userId: parentUserId } },
      },
      include: {
        enrollments: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                instructions: { orderBy: { sortOrder: 'asc' } },
                teachers: {
                  include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
                },
              },
            },
          },
          orderBy: { academicYear: { startsOn: 'desc' } },
        },
        eventEnrollments: {
          include: {
            event: {
              select: {
                id: true, title: true, description: true, eventType: true, eventDate: true,
                costPerChild: true, status: true,
                postMedia: { orderBy: { createdAt: 'asc' } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        studentServices: {
          where: { isActive: true },
          include: {
            service: { select: { id: true, name: true, serviceType: true, monthlyCost: true, pickupCost: true, dropoffCost: true } },
            route: { select: { id: true, name: true } },
            stop: { select: { id: true, name: true, address: true, pickupTime: true, dropoffTime: true } },
          },
        },
        activityRegistrations: {
          where: { status: { not: 'cancelled' } },
          include: {
            activity: {
              select: { id: true, title: true, activityType: true, monthlyCost: true, oneTimeCost: true, startsOn: true, endsOn: true, imageUrl: true },
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
    });
  }

  async create(schoolId: string, dto: CreateStudentDto) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          schoolId,
          fullName: dto.fullName,
          dob: dto.dob ? new Date(dto.dob) : undefined,
          notes: dto.notes,
        },
      });

      // Link existing parent users
      if (dto.parentIds?.length) {
        await tx.studentParent.createMany({
          data: dto.parentIds.map((p) => ({
            studentId: student.id,
            userId: p.userId,
            relation: p.relation,
            isPrimary: p.isPrimary ?? false,
          })),
        });
      }

      // Create new parent users inline
      if (dto.parents?.length) {
        for (let i = 0; i < dto.parents.length; i++) {
          const p = dto.parents[i];
          // Use provided email or generate a placeholder
          const email = p.email?.trim() || `parent-${randomBytes(8).toString('hex')}@omnedu.placeholder`;
          // Check if user with this email already exists
          let user = p.email ? await tx.user.findUnique({ where: { email } }) : null;
          if (!user) {
            user = await tx.user.create({
              data: {
                email,
                fullName: p.fullName,
                phone: normalizePhone(p.phone),
                passwordHash: randomBytes(32).toString('hex'),
              },
            });
          }
          // Add as school member (parent role) if not already
          const existing = await tx.schoolMember.findFirst({ where: { schoolId, userId: user.id } });
          if (!existing) {
            await tx.schoolMember.create({ data: { schoolId, userId: user.id, role: 'parent' } });
          }
          await tx.studentParent.create({
            data: {
              studentId: student.id,
              userId: user.id,
              relation: p.relation || 'parent',
              isPrimary: i === 0,
            },
          });
        }
      }

      if (dto.classId && dto.academicYearId) {
        await tx.classEnrollment.create({
          data: {
            studentId: student.id,
            classId: dto.classId,
            academicYearId: dto.academicYearId,
          },
        });
      }

      return student;
    });
  }

  async update(id: string, schoolId: string, data: {
    fullName?: string; dob?: string; notes?: string; isActive?: boolean; avatarUrl?: string;
    address?: string; allergies?: string; bloodType?: string;
  }) {
    return this.prisma.student.update({
      where: { id },
      data: {
        ...data,
        dob: data.dob ? new Date(data.dob) : undefined,
      },
    });
  }

  async permanentDelete(id: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({ where: { id, schoolId, isActive: false } });
    if (!student) throw new NotFoundException('Archived student not found');
    return this.prisma.student.delete({ where: { id } });
  }

  async getDocuments(studentId: string, schoolId: string, academicYear?: string) {
    return this.prisma.studentDocument.findMany({
      where: { studentId, schoolId, ...(academicYear ? { academicYear } : {}) },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async createDocument(studentId: string, schoolId: string, data: {
    title: string; fileUrl: string; fileType?: string; fileSize?: number;
    category?: string; notes?: string; academicYear?: string;
  }) {
    return this.prisma.studentDocument.create({
      data: { studentId, schoolId, ...data },
    });
  }

  async deleteDocument(documentId: string, schoolId: string) {
    const doc = await this.prisma.studentDocument.findFirst({ where: { id: documentId, schoolId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.studentDocument.delete({ where: { id: documentId } });
  }

  async addParent(studentId: string, schoolId: string, data: {
    fullName: string; email?: string; phone?: string; relation?: string; isPrimary?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({ where: { id: studentId, schoolId } });
      if (!student) throw new Error('Student not found');

      const email = data.email?.trim() || `parent-${randomBytes(8).toString('hex')}@omnedu.placeholder`;
      let user = data.email?.trim() ? await tx.user.findUnique({ where: { email: data.email.trim() } }) : null;
      if (!user) {
        user = await tx.user.create({
          data: { email, fullName: data.fullName, phone: normalizePhone(data.phone), passwordHash: randomBytes(32).toString('hex') },
        });
      } else if (data.phone) {
        user = await tx.user.update({ where: { id: user.id }, data: { phone: normalizePhone(data.phone), fullName: data.fullName || user.fullName } });
      }
      const existing = await tx.schoolMember.findFirst({ where: { schoolId, userId: user.id } });
      if (!existing) await tx.schoolMember.create({ data: { schoolId, userId: user.id, role: 'parent' } });

      const alreadyLinked = await tx.studentParent.findFirst({ where: { studentId, userId: user.id } });
      if (alreadyLinked) return alreadyLinked;

      if (data.isPrimary) {
        await tx.studentParent.updateMany({ where: { studentId, isPrimary: true }, data: { isPrimary: false } });
      }
      return tx.studentParent.create({
        data: { studentId, userId: user.id, relation: data.relation || 'γονέας', isPrimary: data.isPrimary ?? false },
      });
    });
  }

  async updateParent(studentId: string, schoolId: string, parentUserId: string, data: {
    fullName?: string; phone?: string; relation?: string; isPrimary?: boolean;
  }) {
    const exists = await this.prisma.studentParent.findFirst({ where: { studentId, userId: parentUserId } });
    if (!exists) throw new Error('Parent link not found');

    return this.prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.phone !== undefined) {
        await tx.user.update({
          where: { id: parentUserId },
          data: {
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.phone !== undefined ? { phone: normalizePhone(data.phone) } : {}),
          },
        });
      }
      if (data.isPrimary) {
        await tx.studentParent.updateMany({ where: { studentId, isPrimary: true }, data: { isPrimary: false } });
      }
      return tx.studentParent.update({
        where: { studentId_userId: { studentId, userId: parentUserId } },
        data: {
          ...(data.relation !== undefined ? { relation: data.relation } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        },
      });
    });
  }

  async removeParent(studentId: string, schoolId: string, parentUserId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, schoolId } });
    if (!student) throw new Error('Student not found');
    await this.prisma.studentParent.deleteMany({ where: { studentId, userId: parentUserId } });
    return { ok: true };
  }

  async getSiblings(studentId: string, schoolId: string) {
    // Explicit siblings (both directions)
    const [aLinks, bLinks] = await Promise.all([
      this.prisma.studentSibling.findMany({
        where: { studentId },
        include: { sibling: { select: { id: true, fullName: true, dob: true, avatarUrl: true, schoolId: true } } },
      }),
      this.prisma.studentSibling.findMany({
        where: { siblingId: studentId },
        include: { student: { select: { id: true, fullName: true, dob: true, avatarUrl: true, schoolId: true } } },
      }),
    ]);
    const map = new Map<string, any>();
    aLinks.forEach(l => { if (l.sibling.schoolId === schoolId) map.set(l.sibling.id, l.sibling); });
    bLinks.forEach(l => { if (l.student.schoolId === schoolId) map.set(l.student.id, l.student); });
    return Array.from(map.values());
  }

  async linkSibling(studentId: string, siblingId: string, schoolId: string) {
    if (studentId === siblingId) throw new Error('Cannot link a student to themselves');
    // Ensure both students belong to this school
    const [s1, s2] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: studentId, schoolId } }),
      this.prisma.student.findFirst({ where: { id: siblingId, schoolId } }),
    ]);
    if (!s1 || !s2) throw new Error('Student not found');
    // Create bidirectional link (both directions, ignore duplicates)
    await this.prisma.$transaction([
      this.prisma.studentSibling.upsert({
        where: { studentId_siblingId: { studentId, siblingId } },
        create: { studentId, siblingId },
        update: {},
      }),
      this.prisma.studentSibling.upsert({
        where: { studentId_siblingId: { studentId: siblingId, siblingId: studentId } },
        create: { studentId: siblingId, siblingId: studentId },
        update: {},
      }),
    ]);
    return { ok: true };
  }

  async unlinkSibling(studentId: string, siblingId: string) {
    await this.prisma.$transaction([
      this.prisma.studentSibling.deleteMany({ where: { studentId, siblingId } }),
      this.prisma.studentSibling.deleteMany({ where: { studentId: siblingId, siblingId: studentId } }),
    ]);
    return { ok: true };
  }

  async upsertEnrollment(studentId: string, schoolId: string, classId: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');

    const existingEnrollment = await this.prisma.classEnrollment.findFirst({
      where: { studentId, academicYearId: cls.academicYearId },
    });

    if (existingEnrollment) {
      return this.prisma.classEnrollment.update({
        where: { id: existingEnrollment.id },
        data: { classId },
        include: { class: { include: { level: true } } },
      });
    }

    return this.prisma.classEnrollment.create({
      data: { studentId, classId, academicYearId: cls.academicYearId },
      include: { class: { include: { level: true } } },
    });
  }
}
