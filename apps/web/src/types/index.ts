export interface School {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  subscriptionPlan: string;
  isActive: boolean;
  createdAt: string;
  _count?: { members: number; students: number };
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  isActive: boolean;
}

export interface Student {
  id: string;
  fullName: string;
  dob?: string;
  avatarUrl?: string;
  schoolId: string;
}

export interface Class {
  id: string;
  name: string;
  ageGroup?: string;
  capacity?: number;
  _count?: { enrollments: number };
}

export interface DailyReport {
  id: string;
  studentId: string;
  reportDate: string;
  mealBreakfast?: string;
  mealLunch?: string;
  mealSnack?: string;
  napDurationMinutes?: number;
  bathroomCount: number;
  mood?: string;
  notes?: string;
  student?: Pick<Student, 'id' | 'fullName' | 'avatarUrl'>;
  media?: ReportMedia[];
}

export interface ReportMedia {
  id: string;
  url: string;
  mediaType: 'photo' | 'video';
  thumbnailUrl?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  description?: string;
  dueDate?: string;
  status: 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  student?: Pick<Student, 'id' | 'fullName'>;
}
