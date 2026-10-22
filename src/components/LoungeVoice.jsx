import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function liveVideoTracks(stream) {
  return (stream?.getVideoTracks() || []).filter(
    (track) => track.readyState === 'live' && track.enabled && !track.muted
  );
}

function chooseVideoTracks(stream, cameraTrackId, screenTrackId) {
  const tracks = liveVideoTracks(stream);
  const camera = cameraTrackId ? tracks.find((track) => track.id === cameraTrackId) || null : null;
  const screen = screenTrackId ? tracks.find((track) => track.id === screenTrackId) || null : null;
  if (camera || screen) return { camera, screen };
  if (tracks.length === 1) return { camera: tracks[0], screen: null };
  if (tracks.length > 1) return { screen: tracks[0], camera: tracks[1] };
  return { camera: null, screen: null };
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
        self: id === selfId,
        cameraTrackId: entry.cameraTrackId || '',
        screenTrackId: entry.screenTrackId || ''
      });
    });
  });
  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function MediaTile({ stream, cameraTrack, screenTrack, hear }) {
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
        <div className="lounge-stage-media">
          {screenTrack && (
            <video ref={screenEl} className="lounge-video lounge-video-screen" autoPlay playsInline muted />
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
  const [voiceListOpen, setVoiceListOpen] = useState(true);
  const [unseenJoins, setUnseenJoins] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipWindow, setPipWindow] = useState(null);

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
  const voiceListOpenRef = useRef(true);
  const seenVoiceIds = useRef(new Set());
  const voiceListPrimed = useRef(false);
  const sharingRef = useRef(false);
  const screenTrackRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const stageRef = useRef(null);
  const fullscreenAfterDock = useRef(false);

  nameRef.current = getDisplayName(currentUser);
  mutedRef.current = muted;
  cameraRef.current = cameraOn;

  const publishPeers = () => {
    setPeers(
      Array.from(peersRef.current.values()).map((entry) => ({
        id: entry.id,
        name: entry.name,
        stream: entry.stream,
        cameraOn: liveVideoTracks(entry.stream).length > 0,
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
      camera: cameraRef.current,
      sharing: sharingRef.current,
      cameraTrackId: cameraRef.current && cameraTrackRef.current?.enabled ? cameraTrackRef.current.id : '',
      screenTrackId: sharingRef.current ? screenTrackRef.current?.id || '' : ''
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
    const screenTrack = screenTrackRef.current;
    stopStream(localStreamRef.current);
    if (screenTrack && screenTrack.readyState !== 'ended') screenTrack.stop();
    localStreamRef.current = null;
    cameraTrackRef.current = null;
    screenTrackRef.current = null;
    sharingRef.current = false;
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

    stream?.getAudioTracks().forEach((track) => {
      if (track.readyState === 'live') pc.addTrack(track, stream);
    });
    const cameraTrack = cameraTrackRef.current;
    const screenTrack = screenTrackRef.current;
    if (stream && cameraTrack?.readyState === 'live') entry.cameraSender = pc.addTrack(cameraTrack, stream);
    if (stream && screenTrack?.readyState === 'live') entry.screenSender = pc.addTrack(screenTrack, stream);

    pc.onicecandidate = (event) => {
      if (!event.candidate || !joinedRef.current) return;
      sendSignal({ kind: 'ice', to: id, candidate: event.candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      if (!entry.stream) entry.stream = new MediaStream();
      if (!entry.stream.getTracks().some((item) => item.id === event.track.id)) {
        entry.stream.addTrack(event.track);
      }
      watchTrack(id, event.track);
      event.track.addEventListener('ended', () => {
        entry.stream?.removeTrack(event.track);
        publishPeers();
      });
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
      const people = readMembers(channel, selfId).filter((person) => joinedRef.current || !person.self);
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
      setCameraOn(false);
      setSharing(false);
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
    const channel = channelRef.current;
    dropCall();
    setJoined(false);
    setMuted(false);
    setCameraOn(false);
    setSharing(false);
    setLocalStream(null);
    setPeers([]);
    setMembers((people) => people.filter((person) => person.id !== selfId));
    setVoiceError('');
    try {
      await channel?.untrack();
    } catch (error) {
      console.error('Could not leave voice', error);
    }
  };

  const renegotiate = async () => {
    const session = sessionRef.current;
    for (const [id, entry] of peersRef.current) {
      if (!entry.pc || entry.pc.signalingState !== 'stable') continue;
      const offer = await entry.pc.createOffer();
      if (session !== sessionRef.current) return;
      await entry.pc.setLocalDescription(offer);
      sendSignal({ kind: 'offer', to: id, sdp: entry.pc.localDescription });
    }
  };

  const publishTracks = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    let changed = false;
    const roles = [
      ['cameraSender', cameraTrackRef.current],
      ['screenSender', screenTrackRef.current]
    ];
    for (const [, entry] of peersRef.current) {
      if (!entry.pc || entry.pc.signalingState === 'closed') continue;
      for (const [key, track] of roles) {
        const live = Boolean(track && track.readyState === 'live');
        if (live && !stream.getTracks().includes(track)) stream.addTrack(track);
        if (live) {
          if (!entry[key]) {
            entry[key] = entry.pc.addTrack(track, stream);
            changed = true;
          } else if (entry[key].track !== track) {
            await entry[key].replaceTrack(track);
          }
        } else if (entry[key]) {
          try {
            entry.pc.removeTrack(entry[key]);
          } catch (error) {
            console.error('Could not stop a video track', error);
          }
          entry[key] = null;
          changed = true;
        }
      }
    }
    setLocalStream(stream);
    if (changed) await renegotiate();
  };

  const stopScreen = async () => {
    const track = screenTrackRef.current;
    if (!track && !sharingRef.current) return;
    screenTrackRef.current = null;
    sharingRef.current = false;
    setSharing(false);
    if (track) {
      localStreamRef.current?.removeTrack(track);
      track.stop();
    }
    await publishTracks();
    try {
      await announce();
    } catch (error) {
      console.error('Could not update screen share', error);
    }
  };

  const toggleShare = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setVoiceError('');
    if (sharingRef.current) {
      await stopScreen();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = display.getVideoTracks()[0];
      track.contentHint = 'detail';
      track.addEventListener('ended', () => {
        stopScreen();
      });
      screenTrackRef.current = track;
      if (!stream.getTracks().includes(track)) stream.addTrack(track);
      sharingRef.current = true;
      setSharing(true);
      await publishTracks();
      await announce();
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
        setVoiceError('');
        return;
      }
      setVoiceError(error?.message || 'Could not share the screen.');
    }
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
    try {
      const existing = cameraTrackRef.current;
      if (cameraRef.current && existing && existing.readyState === 'live') {
        existing.enabled = false;
        cameraRef.current = false;
        setCameraOn(false);
        await announce();
        publishPeers();
        return;
      }

      if (existing && existing.readyState === 'live') {
        existing.enabled = true;
        if (!stream.getTracks().includes(existing)) stream.addTrack(existing);
        cameraRef.current = true;
        setCameraOn(true);
        setLocalStream(stream);
        await publishTracks();
        await announce();
        return;
      }

      const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const track = camera.getVideoTracks()[0];
      track.contentHint = 'motion';
      track.addEventListener('ended', () => {
        if (cameraTrackRef.current !== track) return;
        cameraTrackRef.current = null;
        cameraRef.current = false;
        setCameraOn(false);
        announce().catch((error) => console.error('Could not update the camera', error));
        publishPeers();
      });
      cameraTrackRef.current = track;
      if (!stream.getTracks().includes(track)) stream.addTrack(track);
      cameraRef.current = true;
      setCameraOn(true);
      setLocalStream(stream);
      await publishTracks();
      await announce();
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        setVoiceError('Allow the camera in the browser, then turn it on again.');
      } else {
        setVoiceError(error?.message || 'Could not start the camera.');
      }
    }
  };

  useEffect(() => {
    voiceListOpenRef.current = voiceListOpen;
    if (voiceListOpen) setUnseenJoins(0);
  }, [voiceListOpen]);

  useEffect(() => {
    if (!voiceListPrimed.current) {
      members.forEach((member) => seenVoiceIds.current.add(member.id));
      if (members.length > 0) voiceListPrimed.current = true;
      return;
    }

    let joins = 0;
    const liveIds = new Set(members.map((member) => member.id));
    members.forEach((member) => {
      if (seenVoiceIds.current.has(member.id)) return;
      seenVoiceIds.current.add(member.id);
      if (!voiceListOpenRef.current && !member.self) joins += 1;
    });
    seenVoiceIds.current.forEach((id) => {
      if (!liveIds.has(id)) seenVoiceIds.current.delete(id);
    });
    if (joins) setUnseenJoins((count) => count + joins);
  }, [members]);

  useEffect(() => {
    const doc = pipWindow?.document || document;
    const onChange = () => setFullscreen(doc.fullscreenElement === stageRef.current);
    doc.addEventListener('fullscreenchange', onChange);
    return () => doc.removeEventListener('fullscreenchange', onChange);
  }, [pipWindow]);

  useEffect(() => {
    if (pipWindow || !fullscreenAfterDock.current) return;
    fullscreenAfterDock.current = false;
    stageRef.current?.requestFullscreen();
  }, [pipWindow]);

  const toggleFullscreen = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const doc = stage.ownerDocument || document;
    if (doc.fullscreenElement) {
      await doc.exitFullscreen();
      return;
    }
    if (pipWindow) {
      fullscreenAfterDock.current = true;
      pipWindow.close();
      setPipWindow(null);
      return;
    }
    await stage.requestFullscreen();
  };

  const copyPipStyles = (pip) => {
    [...document.styleSheets].forEach((sheet) => {
      try {
        const style = pip.document.createElement('style');
        style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
        pip.document.head.append(style);
      } catch {
        if (!sheet.href) return;
        const link = pip.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        pip.document.head.append(link);
      }
    });
    pip.document.body.style.margin = '0';
    pip.document.body.style.height = '100%';
    pip.document.body.style.background = '#070b16';
  };

  const togglePopout = async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }
    if (!window.documentPictureInPicture?.requestWindow) {
      setVoiceError('Pop out works in Chrome and Edge. Full screen works in this browser.');
      return;
    }
    const pip = await window.documentPictureInPicture.requestWindow({ width: 960, height: 540 });
    copyPipStyles(pip);
    pip.addEventListener('pagehide', () => setPipWindow(null));
    setPipWindow(pip);
  };

  const tiles = members
    .filter((member) => joined || !member.self)
    .map((member) => {
      const peer = peers.find((item) => item.id === member.id);
      const isMuted = member.self ? muted : member.muted;
      const stream = member.self ? localStream : peer?.stream;
      const cameraTrackId = member.self
        ? (cameraOn && cameraTrackRef.current?.enabled ? cameraTrackRef.current.id : '')
        : member.cameraTrackId;
      const screenTrackId = member.self
        ? (sharing ? screenTrackRef.current?.id || '' : '')
        : member.screenTrackId;
      const { camera, screen } = chooseVideoTracks(stream, cameraTrackId, screenTrackId);
      const role = screen && camera
        ? 'Camera + screen'
        : screen
          ? 'Screen'
          : camera
            ? 'On camera'
            : isMuted
              ? 'Muted'
              : 'Live';
      return { member, peer, isMuted, stream, camera, screen, role };
    });

  const stage = (
    <div className={`lounge-stage ${pipWindow ? 'is-popped' : ''}`} ref={stageRef}>
      {voiceError && (
        <div className='lounge-stage-error'>
          <p className='live-class-error'>{voiceError}</p>
          <button className='btn-secondary' type='button' onClick={() => setVoiceError('')}>
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
        <button className='btn-secondary' type='button' onClick={toggleFullscreen}>
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
        <button className='btn-secondary' type='button' onClick={togglePopout}>
          {pipWindow ? 'Dock video' : 'Pop out'}
        </button>
      </div>

      {!joined && (
        <button className='btn' type='button' onClick={join} disabled={!ready || joining || !selfId}>
          {joining ? 'Joining...' : 'Join voice'}
        </button>
      )}
      {joined && (
        <div className='lounge-voice-actions'>
          <button className='btn-secondary' type='button' onClick={toggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button className='btn-secondary' type='button' onClick={toggleCamera}>
            {cameraOn ? 'Camera off' : 'Camera on'}
          </button>
          <button className='btn-secondary' type='button' onClick={toggleShare}>
            {sharing ? 'Stop sharing' : 'Share screen'}
          </button>
          <button className='btn' type='button' onClick={leave}>
            Leave voice
          </button>
        </div>
      )}
    </div>
  );

  return (
    <aside className="card lounge-panel lounge-voice">
      {pipWindow ? createPortal(stage, pipWindow.document.body) : stage}

      <section className={`lounge-voice-list ${voiceListOpen ? '' : 'is-collapsed'}`}>
        <button
          type='button'
          className='lounge-drawer-toggle'
          onClick={() => {
            setVoiceListOpen((open) => !open);
            setUnseenJoins(0);
          }}
        >
          <span>In voice</span>
          <span>
            {unseenJoins > 0 && <span className='lounge-badge'>{unseenJoins}</span>}
            {voiceListOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        {voiceListOpen && (
          <div className='lounge-voice-names'>
            {members.map((member) => (
              <span key={member.id}>{member.self ? 'You' : member.name}</span>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
