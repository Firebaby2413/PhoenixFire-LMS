import { useEffect, useRef, useState } from 'react';
import { getDisplayName } from '../utils/academySettings';
import { supabase } from '../utils/supabaseClient';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function selfIdOf(user) {
  return String(user?.id || user?.email || '');
}

function hasLiveVideo(stream) {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled && !track.muted)
  );
}

function readMembers(channel, selfId) {
  const people = [];
  const seen = new Set();
  Object.values(channel.presenceState()).forEach((entries) => {
    entries.forEach((entry) => {
      const id = String(entry.id || '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      people.push({
        id,
        name: entry.name || 'Student',
        muted: Boolean(entry.muted),
        self: id === selfId
      });
    });
  });
  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function MediaTile({ stream, video, hear }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = hear ? stream : null;
  }, [stream, hear]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = video ? stream : null;
  }, [stream, video]);

  return (
    <>
      {hear && <audio ref={audioRef} autoPlay playsInline />}
      {video && <video ref={videoRef} className="lounge-video" autoPlay playsInline muted />}
    </>
  );
}

export default function LoungeVoice({ loungeId, currentUser }) {
  const selfId = selfIdOf(currentUser);
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [members, setMembers] = useState([]);
  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [voiceError, setVoiceError] = useState('');

  const channelRef = useRef(null);
  const peersRef = useRef(new Map());
  const earlyIceRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const joinedRef = useRef(false);
  const sessionRef = useRef(0);
  const nameRef = useRef(getDisplayName(currentUser));
  const mutedRef = useRef(false);
  const cameraRef = useRef(false);
  const handlersRef = useRef({});
  const dropCallRef = useRef(() => {});

  nameRef.current = getDisplayName(currentUser);
  mutedRef.current = muted;
  cameraRef.current = cameraOn;

  const publishPeers = () => {
    setPeers(
      Array.from(peersRef.current.values()).map((entry) => ({
        id: entry.id,
        name: entry.name,
        stream: entry.stream,
        cameraOn: hasLiveVideo(entry.stream),
        connection: entry.pc?.connectionState || 'new'
      }))
    );
  };

  const sendSignal = (payload) => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...payload, from: selfId, name: nameRef.current }
    }).catch((error) => {
      console.error('Voice signal failed', error);
    });
  };

  const announce = async () => {
    const channel = channelRef.current;
    if (!channel || !joinedRef.current) return;
    await channel.track({
      id: selfId,
      name: nameRef.current,
      muted: mutedRef.current,
      camera: cameraRef.current
    });
  };

  const closeEntry = (entry) => {
    if (!entry?.pc) return;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.close();
  };

  const dropCall = () => {
    sessionRef.current += 1;
    joinedRef.current = false;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    peersRef.current.forEach(closeEntry);
    peersRef.current.clear();
    earlyIceRef.current.clear();
  };
  dropCallRef.current = dropCall;

  const watchTrack = (id, track) => {
    const refresh = () => publishPeers();
    track.addEventListener('mute', refresh);
    track.addEventListener('unmute', refresh);
    track.addEventListener('ended', refresh);
  };

  const makePeer = (id, name) => {
    const existing = peersRef.current.get(id);
    if (existing?.pc) {
      existing.name = name || existing.name;
      return existing;
    }

    const stream = localStreamRef.current;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const entry = {
      id,
      name: name || 'Student',
      pc,
      stream: null,
      iceQueue: [...(earlyIceRef.current.get(id) || [])]
    };
    earlyIceRef.current.delete(id);
    peersRef.current.set(id, entry);

    stream?.getTracks().forEach((track) => {
      if (track.readyState === 'live') pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate || !joinedRef.current) return;
      sendSignal({ kind: 'ice', to: id, candidate: event.candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      entry.stream = remoteStream;
      watchTrack(id, event.track);
      publishPeers();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        publishPeers();
      }
      if (pc.connectionState === 'connected') publishPeers();
    };

    return entry;
  };

  const flushIce = async (entry) => {
    const queued = entry.iceQueue.splice(0);
    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Could not add a voice route', error);
      }
    }
  };

  const queueIce = (id, candidate) => {
    const entry = peersRef.current.get(id);
    if (!entry?.pc || !entry.pc.remoteDescription) {
      if (entry) entry.iceQueue.push(candidate);
      else {
        const list = earlyIceRef.current.get(id) || [];
        list.push(candidate);
        earlyIceRef.current.set(id, list);
      }
      return;
    }
    entry.pc.addIceCandidate(candidate).catch((error) => {
      console.error('Could not add a voice route', error);
    });
  };

  const startOffer = async (member) => {
    if (!localStreamRef.current || peersRef.current.has(member.id)) return;
    const session = sessionRef.current;
    const entry = makePeer(member.id, member.name);
    try {
      const offer = await entry.pc.createOffer();
      if (session !== sessionRef.current) return;
      await entry.pc.setLocalDescription(offer);
      sendSignal({ kind: 'offer', to: member.id, sdp: entry.pc.localDescription });
      publishPeers();
    } catch (error) {
      console.error('Could not start a voice connection', error);
    }
  };

  const connectTo = (people) => {
    if (!joinedRef.current) return;
    const ids = new Set(people.filter((person) => !person.self).map((person) => person.id));
    for (const [id, entry] of peersRef.current) {
      if (ids.has(id)) continue;
      closeEntry(entry);
      peersRef.current.delete(id);
    }
    people.forEach((person) => {
      if (person.self || peersRef.current.has(person.id)) return;
      if (selfId < person.id) startOffer(person);
    });
    publishPeers();
  };

  const acceptOffer = async (payload) => {
    const session = sessionRef.current;
    let entry = peersRef.current.get(payload.from);
    if (entry?.pc?.signalingState === 'have-local-offer') {
      if (selfId < payload.from) return;
      try {
        await entry.pc.setLocalDescription({ type: 'rollback' });
      } catch (error) {
        closeEntry(entry);
        peersRef.current.delete(payload.from);
        entry = null;
        console.error('Could not restart a voice handshake', error);
      }
    }
    if (!entry?.pc) entry = makePeer(payload.from, payload.name);
    else entry.name = payload.name || entry.name;

    await entry.pc.setRemoteDescription(payload.sdp);
    await flushIce(entry);
    if (session !== sessionRef.current) return;
    const answer = await entry.pc.createAnswer();
    await entry.pc.setLocalDescription(answer);
    sendSignal({ kind: 'answer', to: payload.from, sdp: entry.pc.localDescription });
    publishPeers();
  };

  const acceptAnswer = async (payload) => {
    const entry = peersRef.current.get(payload.from);
    if (!entry?.pc) return;
    await entry.pc.setRemoteDescription(payload.sdp);
    await flushIce(entry);
    publishPeers();
  };

  handlersRef.current = {
    onSync: () => {
      const channel = channelRef.current;
      if (!channel) return;
      const people = readMembers(channel, selfId);
      setMembers(people);
      connectTo(people);
    },
    onSignal: async (payload) => {
      if (!joinedRef.current || !payload || payload.to !== selfId || payload.from === selfId) return;
      try {
        if (payload.kind === 'offer') await acceptOffer(payload);
        else if (payload.kind === 'answer') await acceptAnswer(payload);
        else if (payload.kind === 'ice') queueIce(payload.from, payload.candidate);
      } catch (error) {
        console.error('Voice signal could not be applied', error);
        setVoiceError('A classmate could not be connected. Leave voice and join again.');
      }
    }
  };

  useEffect(() => {
    if (!loungeId || !selfId) return undefined;
    let active = true;
    const channel = supabase.channel(`lounge-voice-${loungeId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: selfId }
      }
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      if (active) handlersRef.current.onSync?.();
    });
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (active) handlersRef.current.onSignal?.(payload);
    });

    channel.subscribe((status) => {
      if (!active) return;
      if (status === 'SUBSCRIBED') setReady(true);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setVoiceError('Voice cannot reach the lounge right now.');
      }
    });

    return () => {
      active = false;
      dropCallRef.current();
      setJoined(false);
      setLocalStream(null);
      setPeers([]);
      setMembers([]);
      setReady(false);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [loungeId, selfId]);

  const join = async () => {
    if (!channelRef.current || joinedRef.current || joining) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('This browser cannot use a microphone.');
      return;
    }
    setVoiceError('');
    setJoining(true);
    const session = sessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (session !== sessionRef.current) {
        stopStream(stream);
        return;
      }
      localStreamRef.current = stream;
      joinedRef.current = true;
      setLocalStream(stream);
      setJoined(true);
      setMuted(false);
      setCameraOn(false);
      await announce();
      connectTo(readMembers(channelRef.current, selfId));
    } catch (error) {
      dropCall();
      setJoined(false);
      setLocalStream(null);
      if (error?.name === 'NotAllowedError') {
        setVoiceError('Allow the microphone in the browser, then join voice again.');
      } else {
        setVoiceError(error?.message || 'Could not start the microphone.');
      }
    } finally {
      setJoining(false);
    }
  };

  const leave = async () => {
    dropCall();
    setJoined(false);
    setMuted(false);
    setCameraOn(false);
    setLocalStream(null);
    setPeers([]);
    setVoiceError('');
    try {
      await channelRef.current?.untrack();
    } catch (error) {
      console.error('Could not leave voice', error);
    }
    handlersRef.current.onSync?.();
  };

  const toggleMute = async () => {
    const next = !mutedRef.current;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    mutedRef.current = next;
    setMuted(next);
    try {
      await announce();
    } catch (error) {
      console.error('Could not update mute', error);
    }
  };

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setVoiceError('');
    const existing = stream.getVideoTracks()[0];

    try {
      if (cameraRef.current && existing) {
        existing.enabled = false;
        cameraRef.current = false;
        setCameraOn(false);
        await announce();
        publishPeers();
        return;
      }

      if (existing) {
        existing.enabled = true;
        cameraRef.current = true;
        setCameraOn(true);
        await announce();
        return;
      }

      const camera = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = camera.getVideoTracks()[0];
      stream.addTrack(track);
      cameraRef.current = true;
      setCameraOn(true);
      setLocalStream(stream);

      const session = sessionRef.current;
      for (const [id, entry] of peersRef.current) {
        entry.pc.addTrack(track, stream);
        const offer = await entry.pc.createOffer();
        if (session !== sessionRef.current) return;
        await entry.pc.setLocalDescription(offer);
        sendSignal({ kind: 'offer', to: id, sdp: entry.pc.localDescription });
      }
      await announce();
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        setVoiceError('Allow the camera in the browser, then turn it on again.');
      } else {
        setVoiceError(error?.message || 'Could not start the camera.');
      }
    }
  };

  return (
    <aside className="card lounge-panel lounge-voice">
      <h3>Voice</h3>
      <div className="lounge-scroll">
        <p className="lounge-help">
          Join this channel to talk. It stays inside the lounge, so nobody needs a meeting link.
        </p>
        {voiceError && <p className="live-class-error">{voiceError}</p>}
        {members.length === 0 && <p className="live-class-empty">Nobody is in voice yet.</p>}
        {members.map((member) => {
          const peer = peers.find((item) => item.id === member.id);
          const isMuted = member.self ? muted : member.muted;
          const showVideo = member.self ? cameraOn : peer?.cameraOn;
          const stream = member.self ? localStream : peer?.stream;
          return (
            <article key={member.id} className="lounge-voice-member">
              <p className="lounge-voice-name">
                <span className={`lounge-voice-dot ${isMuted ? 'is-muted' : ''}`} />
                <strong>{member.self ? 'You' : member.name}</strong>
                <span className="lounge-role">{isMuted ? 'Muted' : 'Live'}</span>
              </p>
              {joined && !member.self && peer && peer.connection !== 'connected' && (
                <p className="lounge-voice-status">Connecting…</p>
              )}
              {stream && <MediaTile stream={stream} video={showVideo} hear={!member.self} />}
            </article>
          );
        })}
      </div>
      {!joined && (
        <button className="btn" type="button" onClick={join} disabled={!ready || joining || !selfId}>
          {joining ? 'Joining…' : 'Join voice'}
        </button>
      )}
      {joined && (
        <div className="lounge-voice-actions">
          <button className="btn-secondary" type="button" onClick={toggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button className="btn-secondary" type="button" onClick={toggleCamera}>
            {cameraOn ? 'Camera off' : 'Camera on'}
          </button>
          <button className="btn" type="button" onClick={leave}>
            Leave voice
          </button>
        </div>
      )}
    </aside>
  );
}
