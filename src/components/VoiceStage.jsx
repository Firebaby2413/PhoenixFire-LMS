import MediaTile from './MediaTile';
import VoiceControls from './VoiceControls';

export default function VoiceStage({
  stageRef,
  voiceError,
  onDismissError,
  tiles,
  joined,
  fullscreen,
  pipWindow,
  ready,
  joining,
  selfId,
  muted,
  cameraOn,
  sharing,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleCamera,
  onToggleShare,
  onToggleFullscreen,
  onTogglePopout
}) {
  return (
    <div className={`lounge-stage ${pipWindow ? 'is-popped' : ''}`} ref={stageRef}>
      {voiceError && (
        <div className='lounge-stage-error'>
          <p className='live-class-error'>{voiceError}</p>
          <button className='btn-secondary' type='button' onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}
      <div className='lounge-stage-videos'>
        {tiles.length === 0 && (
          <div className='lounge-stage-card'>
            <p>Nobody is in voice yet.</p>
          </div>
        )}
        {tiles.map(({ member, peer, isMuted, stream, camera, screen, role }) => (
          <article key={member.id} className='lounge-stage-card'>
            <p className='lounge-voice-name'>
              <span className={`lounge-voice-dot ${isMuted ? 'is-muted' : ''}`} />
              <strong>{member.self ? 'You' : member.name}</strong>
              <span className='lounge-role'>{role}</span>
            </p>
            {joined && !member.self && peer && peer.connection !== 'connected' && (
              <p className='lounge-voice-status'>Connecting...</p>
            )}
            {stream && (
              <MediaTile stream={stream} cameraTrack={camera} screenTrack={screen} hear={!member.self} />
            )}
          </article>
        ))}
      </div>

      <div className='lounge-stage-tools'>
        <button className='btn-secondary' type='button' onClick={onToggleFullscreen}>
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
        <button className='btn-secondary' type='button' onClick={onTogglePopout}>
          {pipWindow ? 'Dock video' : 'Pop out'}
        </button>
      </div>

      <VoiceControls
        joined={joined}
        ready={ready}
        joining={joining}
        selfId={selfId}
        muted={muted}
        cameraOn={cameraOn}
        sharing={sharing}
        onJoin={onJoin}
        onLeave={onLeave}
        onToggleMute={onToggleMute}
        onToggleCamera={onToggleCamera}
        onToggleShare={onToggleShare}
      />
    </div>
  );
}