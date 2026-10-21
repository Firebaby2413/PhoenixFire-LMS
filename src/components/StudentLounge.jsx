import { useEffect, useRef, useState } from 'react';
import { getDisplayName } from '../utils/academySettings';
import LoungeVoice from './LoungeVoice';
import {
  LOUNGE_STORAGE_KEY,
  addLocalLounge,
  addLocalMessage,
  closeLoungeChannel,
  createLounge,
  deleteLounge,
  fetchLoungeMessages,
  fetchLounges,
  joinLoungePresence,
  readLocalLounge,
  removeLocalLounge,
  sendLoungeMessage,
  subscribeLoungeMessages,
  subscribeLounges
} from '../utils/loungeService';

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function personKey(user) {
  return String(user?.id || user?.email || '');
}

export default function StudentLounge({ currentUser }) {
  const [mode, setMode] = useState('unknown');
  const [lounges, setLounges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [present, setPresent] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [loungeName, setLoungeName] = useState('');
  const [loungeDescription, setLoungeDescription] = useState('');
  const [msgText, setMsgText] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(true);
  const [unseenChats, setUnseenChats] = useState(0);
  const [unseenPeople, setUnseenPeople] = useState(0);
  const chatOpenRef = useRef(true);
  const peopleOpenRef = useRef(true);
  const seenMessageIds = useRef(new Set());
  const seenPeopleIds = useRef(new Set());
  const primedLoungeId = useRef(null);
  const threadRef = useRef(null);
  const you = personKey(currentUser);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    peopleOpenRef.current = peopleOpen;
  }, [chatOpen, peopleOpen]);

  useEffect(() => {
    primedLoungeId.current = null;
    seenMessageIds.current = new Set();
    seenPeopleIds.current = new Set();
    setUnseenChats(0);
    setUnseenPeople(0);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    if (primedLoungeId.current !== selectedId) {
      messages.forEach((message) => seenMessageIds.current.add(message.id));
      present.forEach((person) => seenPeopleIds.current.add(person.id));
      if (messages.length > 0 || present.length > 0) primedLoungeId.current = selectedId;
      return;
    }

    let chats = 0;
    messages.forEach((message) => {
      if (seenMessageIds.current.has(message.id)) return;
      seenMessageIds.current.add(message.id);
      if (!chatOpenRef.current && message.senderId !== currentUser?.id) chats += 1;
    });
    if (chats) setUnseenChats((count) => count + chats);

    let arrived = 0;
    const liveIds = new Set(present.map((person) => person.id));
    present.forEach((person) => {
      if (seenPeopleIds.current.has(person.id)) return;
      seenPeopleIds.current.add(person.id);
      if (!peopleOpenRef.current && person.id !== you) arrived += 1;
    });
    seenPeopleIds.current.forEach((id) => {
      if (!liveIds.has(id)) seenPeopleIds.current.delete(id);
    });
    if (arrived) setUnseenPeople((count) => count + arrived);
  }, [messages, present, selectedId, currentUser?.id, you]);

  const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';
  const selected = lounges.find((lounge) => lounge.id === selectedId) || null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await fetchLounges();
      if (cancelled) return;
      if (!result.ok) {
        if (result.missingTable) {
          setLounges(readLocalLounge().lounges);
          setMode('local');
          setNotice(result.message);
        } else {
          setError(result.message);
        }
        return;
      }
      setLounges(result.rows);
      setMode('remote');
      setNotice('');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'remote') return undefined;
    const channel = subscribeLounges(setLounges);
    return () => closeLoungeChannel(channel);
  }, [mode]);

  useEffect(() => {
    if (selectedId && lounges.some((lounge) => lounge.id === selectedId)) return;
    setSelectedId(lounges[0]?.id || null);
  }, [lounges, selectedId]);

  useEffect(() => {
    if (!selectedId || mode === 'unknown') return undefined;
    let cancelled = false;

    if (mode === 'local') {
      const applyLocal = () => {
        const store = readLocalLounge();
        setMessages(store.messages.filter((item) => item.loungeId === selectedId));
      };
      applyLocal();
      const onStorage = (event) => {
        if (event.key === LOUNGE_STORAGE_KEY) applyLocal();
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }

    const load = async () => {
      const messageResult = await fetchLoungeMessages(selectedId);
      if (cancelled) return;
      if (messageResult.ok) setMessages(messageResult.rows);
      else setError(messageResult.message);
    };

    load();
    const messageChannel = subscribeLoungeMessages(selectedId, (rows) => {
      if (!cancelled) setMessages(rows);
    });

    return () => {
      cancelled = true;
      closeLoungeChannel(messageChannel);
    };
  }, [selectedId, mode]);

  useEffect(() => {
    if (!selectedId || mode === 'unknown') return undefined;
    const channel = joinLoungePresence(selectedId, currentUser, setPresent);
    return () => {
      setPresent([]);
      closeLoungeChannel(channel);
    };
  }, [selectedId, mode, currentUser]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, selectedId]);

  const handleAddLounge = async (event) => {
    event.preventDefault();
    const name = loungeName.trim();
    const description = loungeDescription.trim();
    if (!name) {
      setError('Name the lounge.');
      return;
    }
    if (name.length > 80) {
      setError('Lounge names can be up to 80 characters.');
      return;
    }
    setError('');

    if (mode === 'local') {
      const created = addLocalLounge({ name, description }, currentUser);
      setLounges(readLocalLounge().lounges);
      setSelectedId(created.id);
      setLoungeName('');
      setLoungeDescription('');
      return;
    }

    setPending(true);
    const result = await createLounge({ name, description }, currentUser);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSelectedId(result.item.id);
    setLoungeName('');
    setLoungeDescription('');
  };

  const handleRemoveLounge = async () => {
    if (!selected) return;
    if (!window.confirm(`Remove ${selected.name}? The chat in it is removed too.`)) return;
    setError('');

    if (mode === 'local') {
      setLounges(removeLocalLounge(selected.id));
      return;
    }

    setPending(true);
    const result = await deleteLounge(selected.id);
    setPending(false);
    if (!result.ok) setError(result.message);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const body = msgText.trim();
    if (!body || !selectedId) return;
    if (body.length > 2000) {
      setError('Messages can be up to 2000 characters.');
      return;
    }
    setError('');
    const draft = {
      loungeId: selectedId,
      senderId: currentUser?.id || null,
      senderName: getDisplayName(currentUser),
      senderRole: String(currentUser?.role || 'student').toLowerCase(),
      body
    };

    if (mode === 'local') {
      addLocalMessage(draft);
      setMessages(readLocalLounge().messages.filter((item) => item.loungeId === selectedId));
      setMsgText('');
      return;
    }

    setPending(true);
    const result = await sendLoungeMessage(draft, currentUser);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMsgText('');
  };

  return (
    <div className="section-container lounge-page">
      {notice && <p className="live-class-banner">{notice}</p>}
      {error && <p className="live-class-error">{error}</p>}

      <div className="lounge-layout">
        <aside className="card lounge-list">
          <h2>Lounges</h2>
          {lounges.length === 0 && <p className="live-class-empty">No lounges yet.</p>}
          {lounges.map((lounge) => (
            <button
              key={lounge.id}
              type="button"
              className={`lounge-choice ${lounge.id === selectedId ? 'is-active' : ''}`}
              onClick={() => setSelectedId(lounge.id)}
            >
              <span>{lounge.name}</span>
            </button>
          ))}

          {isAdmin && (
            <form onSubmit={handleAddLounge} className="lounge-create">
              <h3>Add a lounge</h3>
              <input
                className="input-wide"
                placeholder="Lounge name"
                value={loungeName}
                onChange={(event) => setLoungeName(event.target.value)}
              />
              <textarea
                className="input-wide"
                placeholder="What is this lounge for?"
                rows={3}
                value={loungeDescription}
                onChange={(event) => setLoungeDescription(event.target.value)}
              />
              <button className="btn" type="submit" disabled={pending}>
                Add lounge
              </button>
            </form>
          )}
        </aside>

        <section className="lounge-main">
          {!selected && <p className="live-class-empty">Choose a lounge.</p>}
          {selected && (
            <>
              <header className="lounge-heading">
                <div>
                  <h2>{selected.name}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                {isAdmin && (
                  <button type="button" className="btn-secondary lounge-remove" onClick={handleRemoveLounge} disabled={pending}>
                    Remove lounge
                  </button>
                )}
              </header>

              <div className='lounge-panels'>
                <LoungeVoice key={selected.id} loungeId={selected.id} currentUser={currentUser} />

                <div className='lounge-side'>
                  <aside className={`card lounge-panel lounge-drawer ${peopleOpen ? '' : 'is-collapsed'}`}>
                    <button
                      type='button'
                      className='lounge-drawer-toggle'
                      onClick={() => {
                        setPeopleOpen((open) => !open);
                        setUnseenPeople(0);
                      }}
                    >
                      <span>Here now</span>
                      <span>
                        {unseenPeople > 0 && <span className='lounge-badge'>{unseenPeople}</span>}
                        {peopleOpen ? 'Hide' : 'Show'}
                      </span>
                    </button>
                    {peopleOpen && (
                      <div className='lounge-scroll'>
                        {present.length === 0 && (
                          <p className='live-class-empty'>Classmates show up here when they open this lounge.</p>
                        )}
                        {present.map((person) => (
                          <p key={person.id} className='lounge-person'>
                            <span>{person.name}</span>
                            <span className='lounge-role'>
                              {person.id === you ? 'You' : person.role}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </aside>

                  <section className={`card lounge-panel lounge-chat lounge-drawer ${chatOpen ? '' : 'is-collapsed'}`}>
                    <button
                      type='button'
                      className='lounge-drawer-toggle'
                      onClick={() => {
                        setChatOpen((open) => !open);
                        setUnseenChats(0);
                      }}
                    >
                      <span>Chat</span>
                      <span>
                        {unseenChats > 0 && <span className='lounge-badge'>{unseenChats}</span>}
                        {chatOpen ? 'Hide' : 'Show'}
                      </span>
                    </button>
                    {chatOpen && (
                      <>
                        <div className='lounge-scroll' ref={threadRef}>
                          {messages.length === 0 && (
                            <p className='live-class-empty'>Say hello. This chat stays in this lounge.</p>
                          )}
                          {messages.map((message) => (
                            <article
                              key={message.id}
                              className={`lounge-message ${message.senderId === currentUser?.id ? 'is-mine' : ''}`}
                            >
                              <header>
                                <strong>{message.senderName}</strong>
                                <span>{formatWhen(message.createdAt)}</span>
                              </header>
                              <p>{message.body}</p>
                            </article>
                          ))}
                        </div>
                        <form className='lounge-composer' onSubmit={handleSend}>
                          <input
                            className='input-wide'
                            placeholder={`Message ${selected.name}`}
                            value={msgText}
                            onChange={(event) => setMsgText(event.target.value)}
                          />
                          <button className='btn' type='submit' disabled={pending}>Send</button>
                        </form>
                      </>
                    )}
                  </section>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}