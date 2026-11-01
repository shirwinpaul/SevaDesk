"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { addDays, dateInZone } from "@/lib/tasks";
import { EventSchema, type SevaEvent } from "@/types/models";
import { Modal, TextArea, TextInput } from "./ui";

export function EventForm({ existing, onClose, preset }: { existing?: SevaEvent; onClose: () => void; preset?: Partial<SevaEvent> }) {
  const { t } = useUiPrefs();
  const router = useRouter();
  const { save } = useCollection("events", EventSchema);
  const [title, setTitle] = useState(existing?.title ?? preset?.title ?? "");
  const [date, setDate] = useState(existing?.date ?? preset?.date ?? addDays(dateInZone(new Date()), 7));
  const [location, setLocation] = useState(existing?.location ?? preset?.location ?? "");
  const [mapUrl, setMapUrl] = useState(existing?.mapUrl ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const saved = await save({
      ...(existing ?? { id: newId(), createdAt: new Date().toISOString(), shifts: preset?.shifts ?? [], campId: preset?.campId ?? "" }),
      title: title.trim(),
      date,
      location: location.trim(),
      mapUrl: /^https:\/\//.test(mapUrl.trim()) ? mapUrl.trim() : "",
      description,
    });
    onClose();
    if (!existing) router.push(`/events/${saved.id}`);
  }

  return (
    <Modal open title={existing ? t.events.editEvent : t.events.newEvent} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextInput label={t.events.eventTitle} value={title} required maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <TextInput label={t.common.date} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        <TextInput label={t.events.location} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />
        <TextInput label={t.events.mapUrl} type="url" value={mapUrl} maxLength={500} onChange={(e) => setMapUrl(e.target.value)} />
        <TextArea label={t.events.description} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
