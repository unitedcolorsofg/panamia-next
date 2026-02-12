'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';

interface NotesPanelProps {
  sessionId: string;
  initialNotes: string;
}

export function NotesPanel({ sessionId, initialNotes }: NotesPanelProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const debouncedNotes = useDebounce(notes, 1000);

  useEffect(() => {
    const saveNotes = async () => {
      if (debouncedNotes === initialNotes) return;

      setSaving(true);
      try {
        await fetch(`/api/mentoring/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_notes',
            sessionId,
            notes: debouncedNotes,
          }),
        });
      } catch (error) {
        console.error('Error saving notes:', error);
      } finally {
        setSaving(false);
      }
    };

    saveNotes();
  }, [debouncedNotes, sessionId, initialNotes]);

  return (
    <div className="bg-card flex flex-1 flex-col rounded-lg border">
      <div className="flex items-center justify-between border-b p-4 font-semibold">
        <span>Session Notes</span>
        {saving && <span className="text-xs text-gray-500">Saving...</span>}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Take notes during the session..."
        className="flex-1 resize-none border-0"
      />
    </div>
  );
}
