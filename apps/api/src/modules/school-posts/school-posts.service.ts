import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchoolPostsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async findAll(schoolId: string, type?: string, viewer?: { sub: string; role?: string }, studentId?: string) {
    const posts = await this.prisma.schoolPost.findMany({
      where: {
        schoolId,
        publishedAt: { not: null },
        ...(type === 'moment' ? { postType: { in: ['birthday', 'nameday', 'classroom'] } } : {}),
        ...(type && type !== 'moment' ? { postType: type } : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 80,
    });
    if (viewer?.role !== 'parent') return posts;
    const scope = await this.parentScope(schoolId, viewer.sub);
    return posts.filter((post) => this.visibleToParent(post, scope, studentId));
  }

  async findOne(id: string, schoolId: string, viewer?: { sub: string; role?: string }) {
    const post = await this.prisma.schoolPost.findFirst({
      where: { id, schoolId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (viewer?.role === 'parent') {
      const scope = await this.parentScope(schoolId, viewer.sub);
      if (!this.visibleToParent(post, scope)) throw new NotFoundException('Post not found');
    }
    return post;
  }

  async create(schoolId: string, authorId: string, role: string | null | undefined, data: {
    title: string;
    content?: string;
    postType?: string;
    mediaUrls?: string[];
    publishedAt?: string;
    audienceType?: string;
    audienceIds?: string[] | string;
  }) {
    if (role === 'parent') throw new ForbiddenException('Οι γονείς δεν δημοσιεύουν αναρτήσεις.');
    const title = data.title?.trim() ?? '';
    if (!title) throw new BadRequestException('Γράψε έναν τίτλο.');
    const audienceType = ['all', 'class', 'level', 'teachers', 'student'].includes(data.audienceType ?? '')
      ? data.audienceType!
      : 'all';
    const audienceIds = this.audienceIds(data.audienceIds);
    if ((audienceType === 'student' || audienceType === 'class') && this.parseIds(audienceIds).length === 0) {
      throw new BadRequestException(audienceType === 'student' ? 'Διάλεξε παιδί.' : 'Διάλεξε τάξη.');
    }
    const created = await this.prisma.schoolPost.create({
      data: {
        schoolId,
        authorId,
        title,
        content: data.content?.trim() || null,
        postType: data.postType ?? 'general',
        mediaUrls: data.mediaUrls ?? [],
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        audienceType,
        audienceIds,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    if (created.publishedAt) await this.notifyAudience(schoolId, created);
    return created;
  }

  async update(id: string, schoolId: string, authorId: string, data: {
    title?: string;
    content?: string;
    postType?: string;
    mediaUrls?: string[];
    publishedAt?: string | null;
    audienceType?: string;
    audienceIds?: string[] | string;
  }) {
    const post = await this.prisma.schoolPost.findFirst({ where: { id, schoolId } });
    if (!post) throw new NotFoundException('Post not found');

    const updated = await this.prisma.schoolPost.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.postType !== undefined && { postType: data.postType }),
        ...(data.mediaUrls !== undefined && { mediaUrls: data.mediaUrls }),
        ...(data.publishedAt !== undefined && {
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        }),
        ...(data.audienceType !== undefined && { audienceType: data.audienceType }),
        ...(data.audienceIds !== undefined && { audienceIds: this.audienceIds(data.audienceIds) }),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    const becamePublic = !post.publishedAt && updated.publishedAt;
    const changed = post.title !== updated.title
      || (post.content ?? '') !== (updated.content ?? '')
      || JSON.stringify(post.mediaUrls) !== JSON.stringify(updated.mediaUrls);
    if (updated.publishedAt && (becamePublic || changed)) await this.notifyAudience(schoolId, updated);
    return updated;
  }

  private async notifyAudience(schoolId: string, post: {
    id: string;
    title: string;
    content: string | null;
    postType: string;
    mediaUrls: string[];
    audienceType: string;
    audienceIds: string;
  }) {
    const userIds = await this.recipientIds(schoolId, post.audienceType, post.audienceIds);
    const text = (post.content ?? '').replace(/\s+/g, ' ').trim();
    const videos = post.mediaUrls.some((url) => isVideoUrl(url));
    const photos = post.mediaUrls.length
      ? (post.postType === 'excursion'
          ? 'Νέες φωτογραφίες από την εκδρομή.'
          : videos
            ? 'Νέες φωτογραφίες και βίντεο.'
            : 'Νέες φωτογραφίες.')
      : '';
    const body = [text, photos].filter(Boolean).join(' ').slice(0, 180) || 'Νέα ανάρτηση του σχολείου.';
    await this.notifications.notifyUsers(schoolId, userIds, {
      event: 'school_post',
      type: 'school_post',
      title: post.title,
      body,
      data: {
        screen: 'posts',
        postId: post.id,
        ...(post.mediaUrls[0] ? { imageUrl: post.mediaUrls[0] } : {}),
      },
    });
  }

  private async recipientIds(schoolId: string, audienceType: string, audienceIds: string) {
    const ids = this.parseIds(audienceIds);
    if (audienceType === 'teachers') {
      const members = await this.prisma.schoolMember.findMany({
        where: { schoolId, role: 'teacher', isActive: true },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    }
    const parents = await this.prisma.studentParent.findMany({
      where: {
        student: {
          schoolId,
          isActive: true,
          ...(audienceType === 'class' ? { enrollments: { some: { classId: { in: ids } } } } : {}),
          ...(audienceType === 'level' ? { enrollments: { some: { class: { levelId: { in: ids } } } } } : {}),
          ...(audienceType === 'student' ? { id: { in: ids } } : {}),
        },
      },
      select: { userId: true },
    });
    return [...new Set(parents.map((parent) => parent.userId))];
  }

  private async parentScope(schoolId: string, userId: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId } } },
      select: {
        id: true,
        enrollments: {
          select: {
            academicYear: { select: { isCurrent: true } },
            class: { select: { id: true, levelId: true } },
          },
        },
      },
    });
    const studentIds = new Set<string>();
    const classIds = new Set<string>();
    const levelIds = new Set<string>();
    const classIdsByStudent = new Map<string, Set<string>>();
    const levelIdsByStudent = new Map<string, Set<string>>();
    for (const student of students) {
      studentIds.add(student.id);
      const current = student.enrollments.filter((row) => row.academicYear?.isCurrent);
      const rows = current.length ? current : student.enrollments;
      const classes = new Set<string>();
      const levels = new Set<string>();
      for (const row of rows) {
        if (!row.class) continue;
        classes.add(row.class.id);
        classIds.add(row.class.id);
        if (row.class.levelId) {
          levels.add(row.class.levelId);
          levelIds.add(row.class.levelId);
        }
      }
      classIdsByStudent.set(student.id, classes);
      levelIdsByStudent.set(student.id, levels);
    }
    return { studentIds, classIds, levelIds, classIdsByStudent, levelIdsByStudent };
  }

  private visibleToParent(
    post: { audienceType: string; audienceIds: string },
    scope: {
      studentIds: Set<string>;
      classIds: Set<string>;
      levelIds: Set<string>;
      classIdsByStudent: Map<string, Set<string>>;
      levelIdsByStudent: Map<string, Set<string>>;
    },
    studentId?: string,
  ) {
    if (studentId && !scope.studentIds.has(studentId)) return false;
    const ids = this.parseIds(post.audienceIds);
    if (post.audienceType === 'teachers') return false;
    if (post.audienceType === 'student') {
      return studentId ? ids.includes(studentId) : ids.some((id) => scope.studentIds.has(id));
    }
    if (post.audienceType === 'class') {
      if (studentId) return ids.some((id) => scope.classIdsByStudent.get(studentId)?.has(id));
      return ids.some((id) => scope.classIds.has(id));
    }
    if (post.audienceType === 'level') {
      if (studentId) return ids.some((id) => scope.levelIdsByStudent.get(studentId)?.has(id));
      return ids.some((id) => scope.levelIds.has(id));
    }
    return !studentId;
  }

  private parseIds(audienceIds: string) {
    try {
      const parsed = JSON.parse(audienceIds || '[]');
      return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
    } catch {
      return [];
    }
  }

  private audienceIds(value?: string[] | string) {
    if (typeof value === 'string') return value.trim().startsWith('[') ? value : JSON.stringify(value ? [value] : []);
    return JSON.stringify(value ?? []);
  }

  async delete(id: string, schoolId: string) {
    const post = await this.prisma.schoolPost.findFirst({ where: { id, schoolId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.schoolPost.delete({ where: { id } });
  }
}

function isVideoUrl(url: string) {
  return /\/video\/upload\//i.test(url) || /\.(mp4|mov|m4v|webm|avi)(\?|$)/i.test(url);
}
