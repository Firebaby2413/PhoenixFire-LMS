import { createPortal } from 'react-dom';
import { useLoungeCall } from '../hooks/useLoungeCall';
import VoiceStage from './VoiceStage';
import VoiceMemberList from './VoiceMemberList';

export default function LoungeVoice({ loungeId, currentUser }) {
  const {
    selfId,
    ready,
    joined,
    joining,
    muted,
    cameraOn,
    members,
    voiceError,
    setVoiceError,
    voiceListOpen,
    setVoiceListOpen,
    unseenJoins,
    setUnseenJoins,
    sharing,
    fullscreen,
    pipWindow,
    stageRef,
    tiles,
    join,
    leave,
    toggleMute,
    toggleCamera,
    toggleShare,
    toggleFullscreen,
    togglePopout
  } = useLoungeCall({ loungeId, currentUser });

  const stage = (
    <VoiceStage
      stageRef={stageRef}
      voiceError={voiceError}
      onDismissError={() => setVoiceError('')}
      tiles={tiles}
      joined={joined}
      fullscreen={fullscreen}
      pipWindow={pipWindow}
      ready={ready}
      joining={joining}
      selfId={selfId}
      muted={muted}
      cameraOn={cameraOn}
      sharing={sharing}
      onJoin={join}
      onLeave={leave}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
      onToggleShare={toggleShare}
      onToggleFullscreen={toggleFullscreen}
      onTogglePopout={togglePopout}
    />
  );

  return (
    <aside className="card lounge-panel lounge-voice">
      {pipWindow ? createPortal(stage, pipWindow.document.body) : stage}

      <VoiceMemberList
        open={voiceListOpen}
        unseenJoins={unseenJoins}
        members={members}
        onToggle={() => {
          setVoiceListOpen((open) => !open);
          setUnseenJoins(0);
        }}
      />
    </aside>
  );
}