export default function VoiceControls({
  joined,
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
  onToggleShare
}) {
  return (
    <>
      {!joined && (
        <button className='btn' type='button' onClick={onJoin} disabled={!ready || joining || !selfId}>
          {joining ? 'Joining...' : 'Join voice'}
        </button>
      )}
      {joined && (
        <div className='lounge-voice-actions'>
          <button className='btn-secondary' type='button' onClick={onToggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button className='btn-secondary' type='button' onClick={onToggleCamera}>
            {cameraOn ? 'Camera off' : 'Camera on'}
          </button>
          <button className='btn-secondary' type='button' onClick={onToggleShare}>
            {sharing ? 'Stop sharing' : 'Share screen'}
          </button>
          <button className='btn' type='button' onClick={onLeave}>
            Leave voice
          </button>
        </div>
      )}
    </>
  );
}