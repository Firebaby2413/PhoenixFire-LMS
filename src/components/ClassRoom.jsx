import { useEffect, useRef, useState } from 'react';
import LoungeVoice from './LoungeVoice';
import { getDisplayName } from '../utils/academySettings';
import { supabase } from '../utils/supabaseClient';
import { uploadClassRecording } from '../utils/liveClassService';

function mixAudio(displayStream, micStream) {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  [displayStream, micStream].forEach((stream) => {
    const tracks = stream?.getAudioTracks() || [];
    if (!tracks.length) return;
    context.createMediaStreamSource(new MediaStream([tracks[0]])).connect(destination);
  });
  return { context, audioTrack: destination.stream.getAudioTracks()[0] || null };
}

export default function ClassRoom({ session, currentUser, canRecord, onRecordingSaved }) {
  const [recording, setRecording] = useState(false);
  const [recordingBy, setRecordingBy] = useState('');
  const [recordError, setRecordError] = useState('');
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTracksRef = useRef(() => {});
  const channelRef = useRef(null);

  useEffect(() => {
    const channel = supabase.channel(`class-recording-${session.id}`);
    channelRef.current = channel;
    channel
      .on('broadcast', { event: 'recording' }, ({ payload }) => {
        setRecordingBy(payload?.on ? payload.name || 'Someone' : '');
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [session.id]);

  const announce = (on) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { on, name: getDisplayName(currentUser) }
    });
  };

  const releaseRecorder = () => {
    stopTracksRef.current();
    stopTracksRef.current = () => {};
    recorderRef.current = null;
    setRecording(false);
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      releaseRecorder();
      announce(false);
      return;
    }
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      chunksRef.current = [];
      releaseRecorder();
      announce(false);
      if (!blob.size) return;
      setSaving(true);
      const saved = await uploadClassRecording(session.id, blob);
      setSaving(false);
      if (!saved.ok) {
        setRecordError(saved.message || 'The recording did not upload.');
        return;
      }
      onRecordingSaved?.(saved.path);
    };
    recorder.stop();
  };

  const startRecording = async () => {
    setRecordError('');
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        preferCurrentTab: true
      });
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { context, audioTrack } = mixAudio(display, mic);
      const videoTrack = display.getVideoTracks()[0];
      const stream = new MediaStream([videoTrack, audioTrack].filter(Boolean));
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      videoTrack.onended = () => stopRecording();
      stopTracksRef.current = () => {
        display.getTracks().forEach((track) => track.stop());
        mic.getTracks().forEach((track) => track.stop());
        context.close();
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      announce(true);
    } catch (error) {
      setRecordError(error?.message || 'Recording did not start. Share this browser tab and allow the microphone.');
    }
  };

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else stopTracksRef.current();
  }, []);

  return (
    <div className="course-box" style={{ marginTop: 12 }}>
      <div className="live-class-heading">
        <h3 className="pf-title">{session.title}</h3>
        <button type="button" className="btn-secondary btn-inline" onClick={() => onRecordingSaved?.('close')}>
          Close room
        </button>
      </div>
      {(recording || recordingBy) && (
        <p className="live-class-note" role="status">
          This class is being recorded{recordingBy ? ` by ${recordingBy}` : ''} for admin review.
        </p>
      )}
      {recordError && <p className="live-class-error" role="alert">{recordError}</p>}
      {saving && <p className="live-class-note">Saving the recording for admins...</p>}
      <LoungeVoice loungeId={`class-${session.id}`} currentUser={currentUser} />
      {canRecord && (
        <div className="course-actions" style={{ marginTop: 12 }}>
          {recording ? (
            <button type="button" className="btn btn-inline" onClick={stopRecording}>
              Stop recording
            </button>
          ) : (
            <button type="button" className="btn-secondary btn-inline" onClick={startRecording} disabled={saving}>
              Record this class
            </button>
          )}
        </div>
      )}
    </div>
  );
}
