import { Badge } from "@/shared/components/ui/badge";
import { appConfig } from "@/shared/config/app.config";

function WorkflowHero() {
  return (
    <header className="rounded-4xl border border-white/50 bg-white/55 px-5 py-5 shadow-[var(--shadow)] backdrop-blur-xl sm:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Badge className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
            NeuroICU Voice Intake (automation)
          </Badge>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
              Upload, review, generate SOAP, and confirm
            </p>
            <h1
              className="max-w-3xl text-4xl leading-none tracking-[-0.04em] text-[var(--foreground)] sm:text-5xl xl:text-6xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {appConfig.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Upload or record audio, review the returned transcription record,
              request SOAP notes from , and confirm the final result.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default WorkflowHero;
