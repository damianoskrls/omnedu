'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuestionnaireEditor } from '@/components/QuestionnaireEditor';

function NewQuestionnaireInner() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template') === 'registration' ? 'registration' : null;
  return (
    <div className="p-4 sm:p-6">
      <QuestionnaireEditor mode="create" initialTemplate={template} />
    </div>
  );
}

export default function NewQuestionnairePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-3xl mx-auto">
          <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <NewQuestionnaireInner />
    </Suspense>
  );
}
