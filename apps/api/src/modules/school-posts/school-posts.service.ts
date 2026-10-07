import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchoolPostsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async findAll(schoolId: string, type?: string) {
    return this.prisma.schoolPost.findMany({
      where: {
        schoolId,
        publishedAt: { not: null },
        ...(type ? { postType: type } : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string, schoolId: string) {
    const post = await this.prisma.schoolPost.findFirst({
      where: { id, schoolId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(schoolId: string, authorId: string, data: {
    title: string;
    content?: string;
    postType?: string;
    mediaUrls?: string[];
    publishedAt?: string;
    audienceType?: string;
    audienceIds?: string[] | string;
  }) {
    const created = await this.prisma.schoolPost.create({
      data: {
        schoolId,
        authorId,
        title: data.title,
        content: data.content,
        postType: data.postType ?? 'general',
        mediaUrls: data.mediaUrls ?? [],
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        audienceType: data.audienceType ?? 'all',
        audienceIds: this.audienceIds(data.audienceIds),
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
    const photos = post.mediaUrls.length
      ? (post.postType === 'excursion' ? 'Νέες φωτογραφίες από την εκδρομή.' : 'Νέες φωτογραφίες.')
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
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(audienceIds || '[]');
      ids = Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
    } catch {
      ids = [];
    }
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
        },
      },
      select: { userId: true },
    });
    return parents.map((parent) => parent.userId);
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
