import { LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";

import type {
  SoapSections,
  TranscriptionRecord,
} from "@/features/soap-workflow/types";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { appConfig } from "@/shared/config/app.config";
import { useNavigate } from "react-router-dom";

interface WorkflowStepsCardProps {
  confirmationMessage: string;
  hasSoapContent: boolean;
  isConfirmingSoap: boolean;
  isGettingSoaps: boolean;
  isResponseConfirmed: boolean;
  onConfirmReviewedResponse: () => void;
  onConfirmSoapNotes: () => void;
  onGetSoapNotes: () => void;
  onReviewDraftChange: (value: string) => void;
  onSoapSectionChange: (section: keyof SoapSections, value: string) => void;
  reviewDraft: string;
  showWorkflowStepOne: boolean;
  showWorkflowStepThree: boolean;
  showWorkflowStepTwo: boolean;
  soapNotesErrorMessage: string;
  soapSections: SoapSections;
  transcriptionRecord: TranscriptionRecord | null;
}

function WorkflowStepsCard(props: WorkflowStepsCardProps) {
  const {
    confirmationMessage,
    hasSoapContent,
    isConfirmingSoap,
    isGettingSoaps,
    isResponseConfirmed,
    onConfirmReviewedResponse,
    onGetSoapNotes,
    onReviewDraftChange,
    onSoapSectionChange,
    reviewDraft,
    showWorkflowStepOne,
    showWorkflowStepThree,
    showWorkflowStepTwo,
    soapNotesErrorMessage,
    soapSections,
    transcriptionRecord,
  } = props;

  const navigate = useNavigate();

  const handleRefresh = () => {
    navigate(0); // Refresh the current page
  };

  return (
    <Card className="w-full border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
      <CardHeader>
        <CardTitle
          className="text-2xl tracking-[-0.03em] text-[var(--foreground)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Transcription and SOAP workflow
        </CardTitle>
        <CardDescription className="mt-1 text-sm leading-6 text-[var(--muted)]">
          First review <code>transcription.record</code>, then request{" "}
          <code>{appConfig.api.getSoapPath}</code>, then confirm the final SOAP
          note.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!showWorkflowStepOne ? (
          <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.35)] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Workflow steps
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Send a recorded or uploaded voice note first. When the upload
              response arrives, Step 1 opens with the returned transcription
              description.
            </p>
          </div>
        ) : null}

        {showWorkflowStepOne ? (
          <div className="rounded-[28px] border border-white/55 bg-white/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Step 1
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  Confirm the transcription
                </h3>
              </div>
              <Badge
                variant={isResponseConfirmed ? "secondary" : "outline"}
                className={
                  isResponseConfirmed
                    ? "bg-[rgba(15,118,110,0.12)] text-[var(--primary)]"
                    : "border-white/60 bg-white/55"
                }
              >
                {isResponseConfirmed ? "Confirmed" : "Pending"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              This field is populated from{" "}
              <code>transcription.record.description</code>. You can edit it
              before continuing.
            </p>
            {transcriptionRecord ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.55)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    Transcription ID
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                    {transcriptionRecord.id}
                  </p>
                </div>
                {transcriptionRecord.voiceId ? (
                  <div className="rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.55)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Voice ID
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {transcriptionRecord.voiceId}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 space-y-4">
              <Textarea
                disabled={!showWorkflowStepOne}
                placeholder="The transcription description will appear here after you send audio."
                value={reviewDraft}
                onChange={(event) => onReviewDraftChange(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={!reviewDraft.trim()}
                  onClick={onConfirmReviewedResponse}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Confirm transcription
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showWorkflowStepTwo ? (
          <div className="rounded-[28px] border border-white/55 bg-white/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Step 2
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  Get SOAP notes
                </h3>
              </div>
              {hasSoapContent ? (
                <Badge className="bg-[rgba(201,108,49,0.12)] text-[var(--accent)]">
                  SOAP ready
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Send the confirmed transcription <code>id</code> and{" "}
              <code>description</code> to{" "}
              <code>{appConfig.api.getSoapPath}</code>. The returned{" "}
              <code>subjective</code>, <code>objective</code>,{" "}
              <code>assessment</code>, and <code>plan</code> values are shown in
              their own fields below.
            </p>
            <div className="mt-4 space-y-4">
              <Button
                type="button"
                disabled={!isResponseConfirmed || isGettingSoaps}
                onClick={onGetSoapNotes}
              >
                {isGettingSoaps ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Getting SOAP notes
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get SOAP notes
                  </>
                )}
              </Button>
              {soapNotesErrorMessage ? (
                <div className="rounded-2xl border border-[rgba(185,56,47,0.2)] bg-[rgba(255,245,243,0.86)] px-4 py-3 text-sm text-[var(--danger)]">
                  {soapNotesErrorMessage}
                </div>
              ) : null}
              {/* Soap Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Subjective</Label>
                  <Textarea
                    placeholder="Subjective"
                    value={soapSections.subjective}
                    onChange={(event) =>
                      onSoapSectionChange("subjective", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Objective</Label>
                  <Textarea
                    placeholder="Objective"
                    value={soapSections.objective}
                    onChange={(event) =>
                      onSoapSectionChange("objective", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assessment</Label>
                  <Textarea
                    placeholder="Assessment"
                    value={soapSections.assessment}
                    onChange={(event) =>
                      onSoapSectionChange("assessment", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Textarea
                    placeholder="Plan"
                    value={soapSections.plan}
                    onChange={(event) =>
                      onSoapSectionChange("plan", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showWorkflowStepThree ? (
          <div className="rounded-[28px] border border-white/55 bg-white/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Step 3
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  Confirm final result
                </h3>
              </div>
              {confirmationMessage ? (
                <Badge className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
                  Confirmed
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Confirm the edited SOAP note and store it. After confirmation, we
              only show a simple success message.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={!hasSoapContent || isConfirmingSoap}
                onClick={
                  // onConfirmSoapNotes:- No Api calls for now
                  handleRefresh
                }
              >
                {isConfirmingSoap ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Confirming SOAP notes
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Confirm final result
                  </>
                )}
              </Button>
            </div>
            {confirmationMessage ? (
              <div className="mt-4 rounded-2xl border border-[rgba(15,118,110,0.18)] bg-[rgba(241,255,252,0.86)] px-4 py-3 text-sm font-medium text-[var(--primary)]">
                {confirmationMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default WorkflowStepsCard;
