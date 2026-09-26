"use client";

import { useMemo, useState } from "react";

type Uploaded = {
  assetId: string;
  width: number;
  height: number;
};

type Job = {
  id: string;
  state: string;
  result_asset_id?: string;
  result_metadata?: { label?: string; mock?: boolean };
  error_message?: string;
};

async function upload(kind: "source" | "target", file: File) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "Upload failed.");
  return payload.asset as Uploaded;
}

export function SwapStudio() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [sourceAsset, setSourceAsset] = useState<Uploaded | null>(null);
  const [targetAsset, setTargetAsset] = useState<Uploaded | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sourcePreview = useMemo(() => sourceFile ? URL.createObjectURL(sourceFile) : null, [sourceFile]);
  const targetPreview = useMemo(() => targetFile ? URL.createObjectURL(targetFile) : null, [targetFile]);

  async function submit() {
    if (!sourceFile || !targetFile) return;
    setBusy(true);
    setMessage(null);
    setJob(null);
    try {
      const [source, target] = await Promise.all([
        sourceAsset ?? upload("source", sourceFile),
        targetAsset ?? upload("target", targetFile)
      ]);
      setSourceAsset(source);
      setTargetAsset(target);
      const response = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAssetId: source.assetId,
          targetAssetId: target.assetId,
          requestKey: crypto.randomUUID()
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Swap failed.");
      setJob(payload.job);
      await poll(payload.job.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function poll(id: string) {
    for (let i = 0; i < 40; i += 1) {
      const response = await fetch(`/api/swaps/${id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not load status.");
      setJob(payload.swap);
      if (["succeeded", "failed", "canceled"].includes(payload.swap.state)) return;
      await new Promise((resolve) => setTimeout(resolve, i < 5 ? 1000 : 2500));
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-ink">Face swap studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/70">
            Upload one face photo and one target photo. Your first successful guest swap is free; after that, sign in with Google and use subscription credits.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <UploadPane
              label="Face photo"
              preview={sourcePreview}
              file={sourceFile}
              onChange={(file) => {
                setSourceFile(file);
                setSourceAsset(null);
              }}
            />
            <UploadPane
              label="Target photo"
              preview={targetPreview}
              file={targetFile}
              onChange={(file) => {
                setTargetFile(file);
                setTargetAsset(null);
              }}
            />
          </div>

          {message && <p className="mt-4 rounded border border-coral/30 bg-white p-3 text-sm text-coral">{message}</p>}

          <button
            onClick={submit}
            disabled={!sourceFile || !targetFile || busy}
            className="mt-6 rounded bg-pine px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
          >
            {busy ? "Creating swap..." : "Create swap"}
          </button>
        </div>

        <aside className="rounded border border-black/10 bg-white p-5">
          <h2 className="text-base font-semibold">Job status</h2>
          <div className="mt-4 space-y-3 text-sm text-black/70">
            <p>State: <span className="font-semibold text-ink">{job?.state ?? "waiting"}</span></p>
            {job?.result_metadata?.mock && <p className="rounded bg-yellow-50 p-3 text-yellow-900">{job.result_metadata.label}</p>}
            {job?.error_message && <p className="rounded bg-red-50 p-3 text-red-800">{job.error_message}</p>}
            {job?.result_asset_id && (
              <a className="inline-block rounded bg-ink px-4 py-2 font-semibold text-white" href={`/api/assets/${job.result_asset_id}/download`}>
                Download result
              </a>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function UploadPane(props: {
  label: string;
  preview: string | null;
  file: File | null;
  onChange: (file: File) => void;
}) {
  return (
    <label className="block rounded border border-black/10 bg-white p-4">
      <span className="text-sm font-semibold text-ink">{props.label}</span>
      <span className="mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-dashed border-black/20 bg-mist text-sm text-black/50">
        {props.preview ? <img src={props.preview} alt="" className="h-full w-full object-contain" /> : "Choose image"}
      </span>
      <input
        className="mt-4 w-full text-sm"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) props.onChange(file);
        }}
      />
      {props.file && <span className="mt-2 block truncate text-xs text-black/50">{props.file.name}</span>}
    </label>
  );
}
