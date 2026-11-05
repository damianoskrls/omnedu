'use client';

import { useParams } from 'next/navigation';
import { QuestionnaireEditor } from '@/components/QuestionnaireEditor';

export default function EditQuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-4 sm:p-6">
      <QuestionnaireEditor mode="edit" questionnaireId={id} />
    </div>
  );
}
