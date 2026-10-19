'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { classesApi } from '@/lib/api';

export type AcademicYear = {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
};

type AcademicYearContextValue = {
  years: AcademicYear[];
  selectedYear: AcademicYear | null;
  setSelectedYear: (y: AcademicYear) => void;
  refetch: () => void;
};

const AcademicYearContext = createContext<AcademicYearContextValue>({
  years: [],
  selectedYear: null,
  setSelectedYear: () => {},
  refetch: () => {},
});

export function AcademicYearProvider({ schoolId, children }: { schoolId: string; children: ReactNode }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);

  const load = () => {
    if (!schoolId) return;
    classesApi.academicYears(schoolId).then((data: any) => {
      const list: AcademicYear[] = Array.isArray(data) ? data : [];
      setYears(list);
      setSelectedYear(prev => {
        if (prev) {
          const refreshed = list.find(y => y.id === prev.id);
          return refreshed ?? list.find(y => y.isCurrent) ?? list[0] ?? null;
        }
        return list.find(y => y.isCurrent) ?? list[0] ?? null;
      });
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [schoolId]);

  return (
    <AcademicYearContext.Provider value={{ years, selectedYear, setSelectedYear, refetch: load }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  return useContext(AcademicYearContext);
}
