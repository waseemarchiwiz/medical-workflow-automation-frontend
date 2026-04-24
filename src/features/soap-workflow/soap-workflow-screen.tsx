import VoiceNoteWorkspaceCard from "@/features/soap-workflow/components/voice-note-workspace-card";
import WorkflowHero from "@/features/soap-workflow/components/workflow-hero";
import WorkflowStepsCard from "@/features/soap-workflow/components/workflow-steps-card";
import { useSoapWorkflow } from "@/features/soap-workflow/hooks/use-soap-workflow";

function SoapWorkflowScreen() {
  const workflow = useSoapWorkflow();

  return (
    <div className="space-y-6">
      <WorkflowHero />

      <VoiceNoteWorkspaceCard
        audioPreviewUrl={workflow.audioPreviewUrl}
        dragActive={workflow.dragActive}
        fileInputRef={workflow.fileInputRef}
        hasUploadResponse={workflow.showWorkflowStepOne}
        isRecording={workflow.isRecording}
        isSubmitting={workflow.isSubmitting}
        onClearAudio={workflow.clearAudio}
        onDragEnter={workflow.handleDragEnter}
        onDragLeave={workflow.handleDragLeave}
        onDragOver={workflow.handleDragOver}
        onDrop={workflow.handleDrop}
        onFileChange={workflow.handleFileChange}
        onStartRecording={workflow.startRecording}
        onStopRecording={workflow.stopRecording}
        onSubmitAudio={workflow.submitAudio}
        recorderError={workflow.recorderError}
        recordingSeconds={workflow.recordingSeconds}
        selectedAudio={workflow.selectedAudio}
        statusMessage={workflow.statusMessage}
        statusTone={workflow.statusTone}
        submissionPhase={workflow.submissionPhase}
        uploadProgress={workflow.uploadProgress}
        voiceSource={workflow.voiceSource}
      />

      <WorkflowStepsCard
        confirmationMessage={workflow.confirmationMessage}
        hasSoapContent={workflow.hasGeneratedSoapSections}
        isConfirmingSoap={workflow.isConfirmingSoap}
        isGettingSoaps={workflow.isGettingSoaps}
        isResponseConfirmed={workflow.isResponseConfirmed}
        onConfirmReviewedResponse={workflow.confirmReviewedResponse}
        onConfirmSoapNotes={workflow.handleConfirmSoapNotes}
        onGetSoapNotes={workflow.handleGetSoapNotes}
        onReviewDraftChange={workflow.handleReviewDraftChange}
        onSoapSectionChange={workflow.handleSoapSectionChange}
        reviewDraft={workflow.reviewDraft}
        showWorkflowStepOne={workflow.showWorkflowStepOne}
        showWorkflowStepThree={workflow.showWorkflowStepThree}
        showWorkflowStepTwo={workflow.showWorkflowStepTwo}
        soapNotesErrorMessage={workflow.soapNotesErrorMessage}
        soapSections={workflow.soapSections}
        transcriptionRecord={workflow.transcriptionRecord}
      />
    </div>
  );
}

export { SoapWorkflowScreen };
