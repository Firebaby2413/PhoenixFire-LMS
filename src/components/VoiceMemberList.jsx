export default function VoiceMemberList({ open, unseenJoins, members, onToggle }) {
  return (
    <section className={`lounge-voice-list ${open ? '' : 'is-collapsed'}`}>
      <button
        type='button'
        className='lounge-drawer-toggle'
        onClick={onToggle}
      >
        <span>In voice</span>
        <span>
          {unseenJoins > 0 && <span className='lounge-badge'>{unseenJoins}</span>}
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className='lounge-voice-names'>
          {members.map((member) => (
            <span key={member.id}>{member.self ? 'You' : member.name}</span>
          ))}
        </div>
      )}
    </section>
  );
}