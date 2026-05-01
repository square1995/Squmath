"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const FILTER_KEYS = [
  "q",
  "subject",
  "school_level",
  "grade",
  "unit",
  "difficulty",
  "sort",
] as const;

export function ProblemFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [qInput, setQInput] = useState(searchParams.get("q") ?? "");
  const [unitInput, setUnitInput] = useState(searchParams.get("unit") ?? "");

  // ブラウザの戻る・絞り込みクリア時に入力欄を URL と同期させる
  useEffect(() => {
    setQInput(searchParams.get("q") ?? "");
    setUnitInput(searchParams.get("unit") ?? "");
  }, [searchParams]);

  const commit = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("offset");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasAnyFilter = FILTER_KEYS.some((k) => {
    const v = searchParams.get(k);
    return v !== null && v !== "" && !(k === "sort" && v === "updated_desc");
  });

  return (
    <div className="mb-4 p-3 bg-white border border-slate-200 rounded space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit({ q: qInput.trim() });
          }}
          placeholder="タイトルで検索..."
          className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => commit({ q: qInput.trim() })}
          disabled={isPending}
          className="px-3 py-1.5 rounded text-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? "検索中..." : "検索"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <SelectFilter
          aria-label="校種"
          value={searchParams.get("school_level") ?? ""}
          onChange={(v) => commit({ school_level: v })}
          options={[
            { value: "", label: "校種(すべて)" },
            { value: "junior", label: "中学" },
            { value: "high", label: "高校" },
          ]}
        />
        <SelectFilter
          aria-label="学年"
          value={searchParams.get("grade") ?? ""}
          onChange={(v) => commit({ grade: v })}
          options={[
            { value: "", label: "学年(すべて)" },
            { value: "1", label: "1年" },
            { value: "2", label: "2年" },
            { value: "3", label: "3年" },
          ]}
        />
        <SelectFilter
          aria-label="難易度"
          value={searchParams.get("difficulty") ?? ""}
          onChange={(v) => commit({ difficulty: v })}
          options={[
            { value: "", label: "難易度(すべて)" },
            { value: "1", label: "★1" },
            { value: "2", label: "★2" },
            { value: "3", label: "★3" },
            { value: "4", label: "★4" },
            { value: "5", label: "★5" },
          ]}
        />
        <input
          type="text"
          value={unitInput}
          onChange={(e) => setUnitInput(e.target.value)}
          onBlur={() => {
            const v = unitInput.trim();
            if (v !== (searchParams.get("unit") ?? "")) commit({ unit: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit({ unit: unitInput.trim() });
          }}
          placeholder="単元(完全一致)"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm w-[160px]"
        />
        <SelectFilter
          aria-label="並び順"
          value={searchParams.get("sort") ?? "updated_desc"}
          onChange={(v) => commit({ sort: v })}
          options={[
            { value: "updated_desc", label: "更新日(新しい順)" },
            { value: "updated_asc", label: "更新日(古い順)" },
            { value: "created_desc", label: "作成日(新しい順)" },
            { value: "created_asc", label: "作成日(古い順)" },
            { value: "title_asc", label: "タイトル順" },
          ]}
        />
        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending}
            className="px-3 py-1.5 rounded text-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            絞り込みクリア
          </button>
        )}
      </div>
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  "aria-label"?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
