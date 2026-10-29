import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone, phoneKey } from '../auth/phone';
import { CreateStudentDto } from './dto/create-student.dto';

const parentUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  avatarUrl: true,
} as const;

const parentChildSelect = {
  id: true,
  fullName: true,
  dob: true,
  avatarUrl: true,
  address: true,
  allergies: true,
  notes: true,
  bloodType: true,
  isActive: true,
  enrollments: {
    include: {
      class: { select: { id: true, name: true } },
      academicYear: { select: { isCurrent: true, label: true } },
    },
  },
} as const;

type ParentUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
};

type ParentChild = {
  id: string;
  fullName: string;
  dob: Date | null;
  avatarUrl: string | null;
  address: string | null;
  allergies: string | null;
  notes: string | null;
  bloodType: string | null;
  isActive: boolean;
  relation: string | null;
  isPrimary: boolean;
  className: string;
  classId: string | null;
};

type ParentCard = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  notes: string | null;
  children: ParentChild[];
};

function parentCard(user: ParentUser, notes?: string | null): ParentCard {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    notes: notes ?? null,
    children: [],
  };
}

function parentChild(link: {
  relation: string | null;
  isPrimary: boolean;
  student: {
    id: string;
    fullName: string;
    dob: Date | null;
    avatarUrl: string | null;
    address: string | null;
    allergies: string | null;
    notes: string | null;
    bloodType: string | null;
    isActive: boolean;
    enrollments: { classId?: string; class: { id: string; name: string } | null; academicYear: { isCurrent: boolean; label: string } | null }[];
  };
}): ParentChild {
  const current = link.student.enrollments.find((row) => row.academicYear?.isCurrent);
  const enrollment = current ?? link.student.enrollments[0];
  return {
    id: link.student.id,
    fullName: link.student.fullName,
    dob: link.student.dob,
    avatarUrl: link.student.avatarUrl,
    address: link.student.address,
    allergies: link.student.allergies,
    notes: link.student.notes,
    bloodType: link.student.bloodType,
    isActive: link.student.isActive,
    relation: link.relation,
    isPrimary: link.isPrimary,
    className: enrollment?.class?.name ?? '',
    classId: enrollment?.class?.id ?? null,
  };
}

const activityDetailSelect = {
  id: true,
  title: true,
  description: true,
  activityType: true,
  monthlyCost: true,
  oneTimeCost: true,
  startsOn: true,
  endsOn: true,
  imageUrl: true,
  requirements: true,
  scheduleSlots: { orderBy: { dayOfWeek: 'asc' as const } },
  instructorLinks: {
    include: {
      instructor: { select: { id: true, name: true, title: true, bio: true, photoUrl: true } },
    },
  },
};

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, classId?: string, isActive?: boolean, academicYearId?: string) {
    return this.prisma.student.findMany({
      where: {
        schoolId,
        isActive: isActive ?? true,
        ...(classId || academicYearId
          ? { enrollments: { some: { ...(classId ? { classId } : {}), ...(academicYearId ? { academicYearId } : {}) } } }
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
    if (parentUserId) await this.ensureParentChildren(parentUserId, schoolId);
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
            activity: { select: activityDetailSelect },
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
                id: true, title: true, description: true, dayInstructions: true, arriveBy: true, busOperates: true, eventType: true, eventDate: true,
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

    const siblings = await this.getSiblings(id, schoolId);
    return { ...student, siblings };
  }

  async findByParent(parentUserId: string, schoolId: string) {
    await this.ensureParentChildren(parentUserId, schoolId);
    return this.prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        parents: { some: { userId: parentUserId } },
      },
      orderBy: { fullName: 'asc' },
      include: {
        enrollments: {
          include: {
            academicYear: { select: { isCurrent: true, label: true } },
            class: {
              select: {
                id: true,
                name: true,
                levelId: true,
                level: { select: { id: true, name: true } },
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
                id: true, title: true, description: true, dayInstructions: true, arriveBy: true, busOperates: true, eventType: true, eventDate: true,
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
            activity: { select: activityDetailSelect },
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
          gender: dto.gender,
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
          let user = await this.findUserByContact(tx, p.email, p.phone);
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
          // Add as school member (parent role) if not already; reactivate if previously deactivated
          const existing = await tx.schoolMember.findFirst({ where: { schoolId, userId: user.id, role: 'parent' } });
          if (!existing) {
            await tx.schoolMember.create({ data: { schoolId, userId: user.id, role: 'parent' } });
          } else if (!existing.isActive) {
            await tx.schoolMember.update({ where: { id: existing.id }, data: { isActive: true } });
          }
          const alreadyLinked = await tx.studentParent.findFirst({ where: { studentId: student.id, userId: user.id } });
          if (!alreadyLinked) {
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
    // Clean up relations that lack onDelete: Cascade in the schema
    await this.prisma.reportMedia.deleteMany({ where: { studentId: id } });
    await this.prisma.invoice.deleteMany({ where: { studentId: id } });
    await this.prisma.consentSignature.updateMany({ where: { studentId: id }, data: { studentId: null } });
    await this.prisma.notificationBroadcast.updateMany({ where: { targetStudentId: id }, data: { targetStudentId: null } });
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

  async getDocumentById(documentId: string, studentId: string, schoolId: string) {
    const doc = await this.prisma.studentDocument.findFirst({ where: { id: documentId, studentId, schoolId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
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
      let user = await this.findUserByContact(tx, data.email, data.phone);
      if (!user) {
        user = await tx.user.create({
          data: { email, fullName: data.fullName, phone: normalizePhone(data.phone), passwordHash: randomBytes(32).toString('hex') },
        });
      } else if (data.phone) {
        user = await tx.user.update({ where: { id: user.id }, data: { phone: normalizePhone(data.phone), fullName: data.fullName || user.fullName } });
      }
      const existing = await tx.schoolMember.findFirst({ where: { schoolId, userId: user.id, role: 'parent' } });
      if (!existing) {
        await tx.schoolMember.create({ data: { schoolId, userId: user.id, role: 'parent' } });
      } else if (!existing.isActive) {
        await tx.schoolMember.update({ where: { id: existing.id }, data: { isActive: true } });
      }

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
    // StudentSibling only — parent app access expands via ensureParentChildren.
    // Do not copy StudentParent rows (that made unlink leave kids on every parent).
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
    // Drop non-primary parents that were shared across the pair (keeps each child's primary).
    await this.unshareNonPrimaryParents(studentId, siblingId);
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

  /** Same phone is the same parent, even if a second account was created. Siblings of those children count too. */
  async listParents(schoolId: string) {
    const [links, members, deactivated] = await Promise.all([
      this.prisma.studentParent.findMany({
        where: { student: { schoolId } },
        include: { user: { select: parentUserSelect }, student: { select: parentChildSelect } },
      }),
      this.prisma.schoolMember.findMany({
        where: { schoolId, role: 'parent', isActive: true },
        select: { userId: true, notes: true, user: { select: parentUserSelect } },
      }),
      this.prisma.schoolMember.findMany({
        where: { schoolId, role: 'parent', isActive: false },
        select: { userId: true },
      }),
    ]);
    const deletedIds = new Set(deactivated.map((m) => m.userId));
    const notesMap = new Map(members.map((m) => [m.userId, m.notes ?? null]));
    const grouped = new Map<string, ParentCard>();
    for (const member of members) {
      if (deletedIds.has(member.userId)) continue;
      grouped.set(member.userId, parentCard(member.user, member.notes));
    }
    for (const link of links) {
      if (deletedIds.has(link.userId)) continue;
      if (!grouped.has(link.userId)) grouped.set(link.userId, parentCard(link.user, notesMap.get(link.userId)));
      grouped.get(link.userId)!.children.push(parentChild(link));
    }
    return [...grouped.values()]
      .map((card) => ({ ...card, children: card.children.sort((a, b) => a.fullName.localeCompare(b.fullName, 'el')) }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'el'));
  }

  async getParent(schoolId: string, userId: string) {
    const parents = await this.listParents(schoolId);
    const parent = parents.find((row) => row.id === userId);
    if (!parent) throw new NotFoundException('Ο γονέας δεν βρέθηκε');
    return parent;
  }

  async createStandaloneParent(schoolId: string, data: { fullName: string; email?: string; phone?: string; notes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const email = data.email?.trim() || `parent-${randomBytes(8).toString('hex')}@omnedu.placeholder`;
      let user = await this.findUserByContact(tx, data.email, data.phone);
      if (!user) {
        user = await tx.user.create({
          data: { email, fullName: data.fullName, phone: normalizePhone(data.phone), passwordHash: randomBytes(32).toString('hex') },
        });
      }
      const existing = await tx.schoolMember.findFirst({ where: { schoolId, userId: user.id, role: 'parent' } });
      if (!existing) {
        await tx.schoolMember.create({ data: { schoolId, userId: user.id, role: 'parent', notes: data.notes } });
      } else if (!existing.isActive || data.notes !== undefined) {
        await tx.schoolMember.update({
          where: { id: existing.id },
          data: { isActive: true, ...(data.notes !== undefined ? { notes: data.notes } : {}) },
        });
      }
      return this.getParent(schoolId, user.id);
    });
  }

  async updateStandaloneParent(schoolId: string, userId: string, data: { fullName?: string; email?: string; phone?: string; notes?: string }) {
    const member = await this.prisma.schoolMember.findFirst({ where: { schoolId, userId } });
    if (!member) throw new NotFoundException('Ο γονέας δεν βρέθηκε');
    await Promise.all([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.phone !== undefined ? { phone: normalizePhone(data.phone) } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
        },
      }),
      data.notes !== undefined
        ? this.prisma.schoolMember.update({ where: { id: member.id }, data: { notes: data.notes } })
        : Promise.resolve(),
    ]);
    return this.getParent(schoolId, userId);
  }

  async linkChildToParent(schoolId: string, parentUserId: string, studentId: string, options?: { relation?: string; isPrimary?: boolean }) {
    const [member, student] = await Promise.all([
      this.prisma.schoolMember.findFirst({ where: { schoolId, userId: parentUserId, role: 'parent' } }),
      this.prisma.student.findFirst({ where: { id: studentId, schoolId } }),
    ]);
    if (!member) throw new NotFoundException('Ο γονέας δεν βρέθηκε');
    if (!student) throw new NotFoundException('Ο μαθητής δεν βρέθηκε');
    await this.prisma.studentParent.upsert({
      where: { studentId_userId: { studentId, userId: parentUserId } },
      create: { studentId, userId: parentUserId, relation: options?.relation, isPrimary: options?.isPrimary ?? false },
      update: { relation: options?.relation, isPrimary: options?.isPrimary ?? false },
    });
    return this.getParent(schoolId, parentUserId);
  }

  async unlinkChildFromParent(schoolId: string, parentUserId: string, studentId: string) {
    const member = await this.prisma.schoolMember.findFirst({ where: { schoolId, userId: parentUserId } });
    if (!member) throw new NotFoundException('Ο γονέας δεν βρέθηκε');
    await this.prisma.studentParent.deleteMany({ where: { studentId, userId: parentUserId } });
    return { ok: true };
  }

  async deleteStandaloneParent(schoolId: string, userId: string) {
    const member = await this.prisma.schoolMember.findFirst({ where: { schoolId, userId } });
    if (!member) throw new NotFoundException('Ο γονέας δεν βρέθηκε');
    await this.prisma.$transaction([
      this.prisma.schoolMember.updateMany({ where: { schoolId, userId }, data: { isActive: false } }),
      // Soft-delete alone left StudentParent links, so the parent reappeared on refresh.
      this.prisma.studentParent.deleteMany({ where: { userId, student: { schoolId } } }),
    ]);
    return { ok: true };
  }

  async ensureParentChildren(parentUserId: string, schoolId: string) {
    const userIds = await this.accountUserIds(parentUserId);
    const activeParentIds = await this.parentAccountIds(userIds, schoolId);
    if (!activeParentIds.includes(parentUserId)) return;

    const direct = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId: { in: activeParentIds } } } },
      select: { id: true },
    });
    const directIds = direct.map((row) => row.id);
    if (!directIds.length) return;

    const links = await this.prisma.studentSibling.findMany({
      where: { OR: [{ studentId: { in: directIds } }, { siblingId: { in: directIds } }] },
      select: { studentId: true, siblingId: true },
    });
    const siblingIds = new Set<string>();
    for (const link of links) {
      if (!directIds.includes(link.studentId)) siblingIds.add(link.studentId);
      if (!directIds.includes(link.siblingId)) siblingIds.add(link.siblingId);
    }
    const extras = siblingIds.size
      ? await this.prisma.student.findMany({
          where: { schoolId, isActive: true, id: { in: [...siblingIds] } },
          select: { id: true },
        })
      : [];
    const studentIds = [...new Set([...directIds, ...extras.map((row) => row.id)])];
    // Only materialize links for the logged-in account — never re-create a second
    // same-phone Damianos the admin just removed.
    const existing = await this.prisma.studentParent.findMany({
      where: { studentId: { in: studentIds }, userId: parentUserId },
      select: { studentId: true, userId: true, relation: true },
    });
    const have = new Set(existing.map((row) => row.studentId));
    const relation = existing[0]?.relation ?? 'γονέας';
    const data = studentIds
      .filter((studentId) => !have.has(studentId))
      .map((studentId) => ({ studentId, userId: parentUserId, relation, isPrimary: false }));
    if (data.length) await this.prisma.studentParent.createMany({ data, skipDuplicates: true });
  }

  private async parentAccountIds(userIds: string[], schoolId: string) {
    if (!userIds.length) return userIds;
    const members = await this.prisma.schoolMember.findMany({
      where: { schoolId, userId: { in: userIds }, role: 'parent', isActive: true },
      select: { userId: true },
    });
    return members.map((row) => row.userId);
  }

  private async accountUserIds(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const key = phoneKey(user?.phone);
    if (!key) return [userId];
    const users = await this.prisma.user.findMany({
      where: { isActive: true, phone: { not: null } },
      select: { id: true, phone: true },
    });
    const ids = users.filter((row) => phoneKey(row.phone) === key).map((row) => row.id);
    return ids.length ? ids : [userId];
  }

  /**
   * After sibling unlink, drop parents that clearly came from the other child:
   * primary on one side, non-primary on the other. Leaves true secondary parents alone.
   */
  private async unshareNonPrimaryParents(studentId: string, siblingId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { studentId: { in: [studentId, siblingId] } },
      select: { studentId: true, userId: true, isPrimary: true },
    });
    const primaryA = new Set(
      links.filter((l) => l.studentId === studentId && l.isPrimary).map((l) => l.userId),
    );
    const primaryB = new Set(
      links.filter((l) => l.studentId === siblingId && l.isPrimary).map((l) => l.userId),
    );
    const removals = links.filter((l) => {
      if (l.isPrimary) return false;
      if (l.studentId === studentId) return primaryB.has(l.userId);
      return primaryA.has(l.userId);
    });
    if (!removals.length) return;
    await this.prisma.$transaction(
      removals.map((row) =>
        this.prisma.studentParent.deleteMany({
          where: { studentId: row.studentId, userId: row.userId },
        }),
      ),
    );
  }

  private async findUserByContact(
    db: { user: PrismaService['user'] },
    email?: string | null,
    phone?: string | null,
  ) {
    const trimmed = email?.trim();
    if (trimmed) {
      const byEmail = await db.user.findUnique({ where: { email: trimmed } });
      if (byEmail) return byEmail;
    }
    const key = phoneKey(phone);
    if (!key) return null;
    const candidates = await db.user.findMany({
      where: { isActive: true, phone: { not: null } },
      select: { id: true, phone: true },
    });
    const match = candidates.find((row) => phoneKey(row.phone) === key);
    return match ? db.user.findUnique({ where: { id: match.id } }) : null;
  }
}
