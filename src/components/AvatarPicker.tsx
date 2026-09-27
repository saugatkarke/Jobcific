"use client";

import { useState, type CSSProperties } from "react";
import {
  DEFAULT_AVATAR_STYLE,
  avatarUrl,
  parseAvatarUrl,
  randomAvatarSeeds,
  type AvatarChoice,
} from "@/lib/avatar";
import { BusyButton } from "./BusyButton";
import { UserAvatar } from "./UserAvatar";

const OPTION_COUNT = 12;
const style = DEFAULT_AVATAR_STYLE;

function seedsFor(current: AvatarChoice | null) {
  const seeds = randomAvatarSeeds(OPTION_COUNT);
  if (current) seeds[0] = current.seed;
  return seeds;
}

export function AvatarPicker({
  current,
  onSaved,
  onCancel,
}: {
  current: string | null;
  onSaved: (url: string) => void;
  onCancel: () => void;
}) {
  const currentChoice = parseAvatarUrl(current);
  const [seeds, setSeeds] = useState(() => seedsFor(currentChoice));
  const [selected, setSelected] = useState<AvatarChoice | null>(currentChoice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const data = (await res.json()) as { image?: string };
      if (!res.ok || !data.image) throw new Error("save failed");
      onSaved(data.image);
    } catch {
      setError("Could not save your avatar. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedUrl = selected ? avatarUrl(selected) : null;

  return (
    <div className="mt-4 space-y-4">
      <div
        className="grid grid-cols-4 gap-2 sm:grid-cols-6"
        role="radiogroup"
        aria-label="Avatar options"
      >
        {seeds.map((seed, index) => {
          const url = avatarUrl({ style, seed });
          const isSelected = url === selectedUrl;
          return (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Avatar option ${index + 1}`}
              onClick={() => setSelected({ style, seed })}
              style={{ "--avatar-delay": `${index * 90}ms` } as CSSProperties}
              className={`justify-self-center rounded-full p-0.5 transition-shadow duration-200 ${
                isSelected
                  ? "ring-2 ring-black ring-offset-2"
                  : "hover:ring-2 hover:ring-neutral-300"
              }`}
            >
              <UserAvatar src={url} size={56} motion="once" />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BusyButton
          type="button"
          className="btn-primary gap-2"
          busy={saving}
          busyLabel="Saving"
          disabled={!selected || selectedUrl === current}
          onClick={save}
        >
          Save avatar
        </BusyButton>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setSeeds(randomAvatarSeeds(OPTION_COUNT))}
        >
          Shuffle
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--muted)] hover:text-black"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
