type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfJsReady: Promise<PdfJsModule> | null = null;

/** Legacy pdf.js build (includes Math.sumPrecise polyfill in the worker). */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsReady) {
    pdfJsReady = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = await import(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"
      );
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }

  return pdfJsReady;
}
