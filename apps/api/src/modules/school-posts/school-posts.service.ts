import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchoolPostsService {
  constructor(private prisma: PrismaService) {}

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
  }) {
    return this.prisma.schoolPost.create({
      data: {
        schoolId,
        authorId,
        title: data.title,
        content: data.content,
        postType: data.postType ?? 'general',
        mediaUrls: data.mediaUrls ?? [],
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }

  async update(id: string, schoolId: string, authorId: string, data: {
    title?: string;
    content?: string;
    postType?: string;
    mediaUrls?: string[];
    publishedAt?: string | null;
  }) {
    const post = await this.prisma.schoolPost.findFirst({ where: { id, schoolId } });
    if (!post) throw new NotFoundException('Post not found');

    return this.prisma.schoolPost.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.postType !== undefined && { postType: data.postType }),
        ...(data.mediaUrls !== undefined && { mediaUrls: data.mediaUrls }),
        ...(data.publishedAt !== undefined && {
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        }),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }

  async delete(id: string, schoolId: string) {
    const post = await this.prisma.schoolPost.findFirst({ where: { id, schoolId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.schoolPost.delete({ where: { id } });
  }
}
