import React, { useEffect, useState } from 'react';
import { getLessonFlashcards } from '../utils/moduleTypes';
import {
  addStudentFlashcard,
  deleteStudentFlashcard,
  loadStudentFlashcards,
  updateStudentFlashcard
} from '../utils/studentFlashcards';

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildTiles(cards) {
  const tiles = [];
  cards.forEach((card, i) => {
    const pairId = String(card.id || `pair_${i}`);
    tiles.push({
      id: `${pairId}-front`,
      pairId,
      text: String(card.front || '').trim() || '(blank)',
      label: 'Prompt'
    });
    tiles.push({
      id: `${pairId}-back`,
      pairId,
      text: String(card.back || '').trim() || '(blank)',
      label: 'Answer'
    });
  });
  return shuffle(tiles);
}

const fieldStyle = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #475569',
  borderRadius: '6px',
  color: '#fff',
  padding: '8px 12px',
  marginBottom: '8px'
};

export default function FlashcardStudy({ course, lesson, currentUser, onBack }) {
  const officialCards = getLessonFlashcards(lesson);
  const isStudent = String(currentUser?.role || '').toLowerCase() === 'student';
  const studentId = currentUser?.id || '';

  const [personalCards, setPersonalCards] = useState([]);
  const [draftFront, setDraftFront] = useState('');
  const [draftBack, setDraftBack] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [cardNote, setCardNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [tiles, setTiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [score, setScore] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!isStudent || !studentId || !course?.id || !lesson?.id) {
      setPersonalCards([]);
      return undefined;
    }
    let cancelled = false;
    loadStudentFlashcards(studentId, course.id, lesson.id).then((result) => {
      if (!cancelled) setPersonalCards(result.cards);
    });
    return () => {
      cancelled = true;
    };
  }, [isStudent, studentId, course?.id, lesson?.id]);

  const playableCards = [
    ...officialCards,
    ...personalCards.filter((card) => String(card.front || '').trim() || String(card.back || '').trim())
  ];
  const cardSignature = playableCards.map((card) => `${card.id}:${card.front}:${card.back}`).join('|');
  const [dealtSignature, setDealtSignature] = useState(null);
  if (dealtSignature !== cardSignature) {
    setDealtSignature(cardSignature);
    setTiles(buildTiles(playableCards));
    setSelectedIds([]);
    setMatchedIds([]);
    setScore(0);
    setIsChecking(false);
  }

  const restartGame = () => {
    setTiles(buildTiles(playableCards));
    setSelectedIds([]);
    setMatchedIds([]);
    setScore(0);
    setIsChecking(false);
  };

  const rememberRemote = (remote) => {
    setCardNote(
      remote
        ? ''
        : 'Saved on this browser. Run supabase/migrations/20261021210000_course_restart_and_flashcards.sql so these cards follow you to other devices.'
    );
  };

  const handleAddCard = async () => {
    const front = draftFront.trim();
    const back = draftBack.trim();
    if (!front || !back) {
      alert('Enter both a prompt and an answer.');
      return;
    }
    setSaving(true);
    try {
      const result = await addStudentFlashcard(studentId, course.id, lesson.id, front, back);
      setPersonalCards((prev) => [...prev.filter((card) => card.id !== result.card.id), result.card]);
      setDraftFront('');
      setDraftBack('');
      rememberRemote(result.remote);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (card) => {
    const front = editFront.trim();
    const back = editBack.trim();
    if (!front || !back) {
      alert('Enter both a prompt and an answer.');
      return;
    }
    setSaving(true);
    try {
      const result = await updateStudentFlashcard(studentId, card, front, back);
      setPersonalCards((prev) => prev.map((item) => (item.id === card.id ? result.card : item)));
      setEditingId('');
      rememberRemote(result.remote);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (card) => {
    const ok = window.confirm('Delete this flashcard? Course cards are not affected.');
    if (!ok) return;
    setSaving(true);
    try {
      const result = await deleteStudentFlashcard(studentId, card.id);
      setPersonalCards((prev) => prev.filter((item) => item.id !== card.id));
      if (editingId === card.id) setEditingId('');
      rememberRemote(result.remote);
    } finally {
      setSaving(false);
    }
  };

  if (!lesson) {
    return (
      <div style={{ color: '#fff', padding: '20px' }}>
        <button
          type='button'
          onClick={onBack}
          style={{
            background: '#1f2937',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>
        <p>No lesson selected.</p>
      </div>
    );
  }

  const handleTileClick = (tile) => {
    if (isChecking) return;
    if (matchedIds.includes(tile.pairId)) return;
    if (selectedIds.includes(tile.id)) return;
    if (selectedIds.length >= 2) return;

    const nextSelected = [...selectedIds, tile.id];
    setSelectedIds(nextSelected);

    if (nextSelected.length < 2) return;

    const first = tiles.find((item) => item.id === nextSelected[0]);
    const second = tiles.find((item) => item.id === nextSelected[1]);
    if (!first || !second) return;

    if (first.pairId === second.pairId) {
      setMatchedIds((prev) => [...prev, first.pairId]);
      setScore((prev) => prev + 1);
      setSelectedIds([]);
      return;
    }

    setIsChecking(true);
    window.setTimeout(() => {
      setSelectedIds([]);
      setIsChecking(false);
    }, 800);
  };

  const totalPairs = playableCards.length;
  const won = totalPairs > 0 && matchedIds.length === totalPairs;

  return (
    <div style={{ color: '#fff', padding: '10px', maxWidth: '900px' }}>
      <button
        type='button'
        onClick={onBack}
        style={{
          background: '#1f2937',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        ← Back to Course Contents
      </button>

      <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
        {course?.title}
      </h2>
      <h3 style={{ fontSize: '18px', color: '#f97316', margin: ' 0 0 8px 0' }}>
        {lesson.title} - Match Game
      </h3>
      <p style={{ color: '#9ca3af', margin: '0 0 16px 0' }}>
        Flip two cards. A matching prompt and answer scores 1 point. This does not count towards course progress.
        {officialCards.length > 0
          ? ` ${officialCards.length} course card${officialCards.length === 1 ? '' : 's'} are included and cannot be edited here.`
          : ''}
      </p>

      {isStudent && (
        <div
          style={{
            background: '#111827',
            border: '1px solid #4338ca',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}
        >
          <h4 style={{ margin: '0 0 8px 0' }}>Your flashcards</h4>
          <p style={{ color: '#9ca3af', margin: '0 0 12px 0', fontSize: '14px' }}>
            Add, edit, or delete cards for your own study. These stay yours and do not change the course.
          </p>
          {cardNote && (
            <p style={{ color: '#fb923c', fontSize: '13px' }}>{cardNote}</p>
          )}

          {personalCards.length === 0 && (
            <p style={{ fontSize: '14px', opacity: 0.8 }}>You have not added any cards for this lesson yet.</p>
          )}

          {personalCards.map((card) => (
            <div
              key={card.id}
              style={{
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '10px'
              }}
            >
              {editingId === card.id ? (
                <>
                  <input
                    style={fieldStyle}
                    value={editFront}
                    onChange={(event) => setEditFront(event.target.value)}
                    placeholder='Prompt'
                  />
                  <input
                    style={fieldStyle}
                    value={editBack}
                    onChange={(event) => setEditBack(event.target.value)}
                    placeholder='Answer'
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type='button' className='btn-inline' onClick={() => handleSaveEdit(card)} disabled={saving}>
                      Save
                    </button>
                    <button type='button' className='btn-outline btn-inline' onClick={() => setEditingId('')}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div><strong>Prompt:</strong> {card.front}</div>
                  <div style={{ margin: '4px 0 8px' }}><strong>Answer:</strong> {card.back}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type='button'
                      className='btn-secondary btn-inline'
                      onClick={() => {
                        setEditingId(card.id);
                        setEditFront(card.front || '');
                        setEditBack(card.back || '');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type='button'
                      className='btn-outline btn-danger btn-inline'
                      onClick={() => handleDeleteCard(card)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <input
            style={fieldStyle}
            value={draftFront}
            onChange={(event) => setDraftFront(event.target.value)}
            placeholder='New prompt'
          />
          <input
            style={fieldStyle}
            value={draftBack}
            onChange={(event) => setDraftBack(event.target.value)}
            placeholder='New answer'
          />
          <button type='button' className='btn-secondary' onClick={handleAddCard} disabled={saving}>
            {saving ? 'Saving…' : '+ Add flashcard'}
          </button>
        </div>
      )}

      {playableCards.length === 0 ? (
        <p>No flashcards in this lesson yet.</p>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <p style={{ margin: 0, fontSize: '16px' }}>
              Score: <strong style={{ color: '#34d399' }}>{score}</strong> / {totalPairs}
              {won ? ' — All pairs matched!' : ''}
            </p>
            <button
              type='button'
              onClick={restartGame}
              style={{
                background: '#312e81',
                color: '#fff',
                border: '1px solid #4338ca',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Play again?
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px'
            }}
          >
            {tiles.map((tile) => {
              const isMatched = matchedIds.includes(tile.pairId);
              const isSelected = selectedIds.includes(tile.id);
              const faceUp = isMatched || isSelected;

              return (
                <button
                  key={tile.id}
                  type='button'
                  onClick={() => handleTileClick(tile)}
                  style={{
                    minHeight: '120px',
                    background: isMatched
                      ? 'rgba(16, 185, 129, 0.2)'
                      : faceUp
                        ? '#1e293b'
                        : '#111827',
                    border: `1px solid ${isMatched ? '#10b981' : faceUp ? '#f97316' : '#374151'}`,
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '12px',
                    cursor: isMatched || isChecking ? 'default' : 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {faceUp ? (
                    <>
                      <div style={{ fontSize: '11px', color: '#fb923c', marginBottom: '8px' }}>
                        {tile.label}
                      </div>
                      <div>{tile.text}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: '28px', color: '#64748b' }}>?</div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
