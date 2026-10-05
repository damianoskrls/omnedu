import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('el-GR', { dateStyle: 'medium' }).format(new Date(date));
}

export function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency }).format(amount);
}
