import { useRef, useState } from "react";
import {
  parseSyllabusFile,
  syllabusUploadStatus,
  SyllabusParseError,
} from "../../lib/parseSyllabus";
import type { SyllabusOutlineData } from "../../types/syllabus";

export type SyllabusSource = "default" | "upload" | "example" | "prebuilt";

export interface SyllabusLoadResult {
  data: SyllabusOutlineData;
  source: SyllabusSource;
  fileName?: string;
}

interface SyllabusUploadProps {
  onSyllabusLoaded: (result: SyllabusLoadResult) => void;
  compact?: boolean;
}

export function SyllabusUpload({
  onSyllabusLoaded,
  compact = false,
}: SyllabusUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Parsing syllabus…");
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage(syllabusUploadStatus(file));
    setError(null);

    try {
      const data = await parseSyllabusFile(file);
      onSyllabusLoaded({ data, source: "upload", fileName: file.name });
    } catch (err) {
      setError(
        err instanceof SyllabusParseError
          ? err.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="space-y-6">
      {!compact && (
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-honey-600">
            Upload syllabus
          </p>
          <h2 className="mt-1 font-serif text-2xl text-stone-900">
            Import a syllabus
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500">
            Upload a PDF or JSON syllabus. The course will be added to your list
            and opened automatically.
          </p>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-honey-400 bg-honey-50"
            : "border-stone-200 bg-white hover:border-honey-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.json,application/pdf,application/json"
          onChange={onInputChange}
          className="sr-only"
          aria-label="Upload syllabus PDF or JSON file"
        />

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-honey-100 text-honey-700">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>

        <p className="text-sm font-medium text-stone-800">
          {isLoading
            ? loadingMessage
            : "Drag & drop a PDF or JSON syllabus here"}
        </p>
        <p className="mt-1 text-xs text-stone-400">or</p>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-lg bg-honey-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-honey-800 disabled:opacity-60"
        >
          Choose file
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
