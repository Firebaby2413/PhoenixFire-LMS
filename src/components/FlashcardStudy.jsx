import React, { useEffect, useState } from 'react';
import { getLessonFlashcards } from '../utils/moduleTypes';

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

export default function FlashcardStudy({ course, lesson, onBack }) {
  const cards = getLessonFlashcards(lesson);
  const [tiles, setTiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [score, setScore] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setTiles(buildTiles(cards));
    setSelectedIds([]);
    setMatchedIds([]);
    setScore(0);
    setIsChecking(false);
  }, [lesson?.id]);
  
  const restartGame = () => {
    setTiles(buildTiles(cards));
    setSelectedIds([]);
    setMatchedIds([]);
    setScore(0);
    setIsChecking(false);
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

    const nextSelected = [ ...selectedIds, tile.id];
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

  const totalPairs = cards.length;
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
      </p>

      {cards.length === 0 ? (
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
