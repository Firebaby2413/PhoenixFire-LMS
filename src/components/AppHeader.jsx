export default function AppHeader({ title, theme, onToggleTheme }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h1 className='pf-title bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent' style={{ margin: 0 }}>
        {title}
      </h1>
      <button
        className='theme-toggle'
        style={{ position: 'static' }}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  );
}