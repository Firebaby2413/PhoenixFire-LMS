import { useEffect, useRef } from 'react';

export default function MediaTile({ stream, cameraTrack, screenTrack, hear }) {
  const audioRef = useRef(null);
  const cameraEl = useRef(null);
  const screenEl = useRef(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = hear && stream ? stream : null;
  }, [stream, hear]);

  useEffect(() => {
    if (screenEl.current) {
      screenEl.current.srcObject = screenTrack ? new MediaStream([screenTrack]) : null;
    }
  }, [screenTrack]);

  useEffect(() => {
    if (cameraEl.current) {
      cameraEl.current.srcObject = cameraTrack ? new MediaStream([cameraTrack]) : null;
    }
  }, [cameraTrack]);

  return (
    <>
      {hear && <audio ref={audioRef} autoPlay playsInline />}
      {(screenTrack || cameraTrack) && (
        <div className='lounge-stage-media'>
          {screenTrack && (
            <video ref={screenEl} className='lounge-video lounge-video-screen' autoPlay playsInline muted />
          )}
          {cameraTrack && (
            <video
              ref={cameraEl}
              className={`lounge-video ${screenTrack ? 'lounge-video-face' : ''}`}
              autoPlay
              playsInline
              muted
            />
          )}
        </div>
      )}
    </>
  );
}