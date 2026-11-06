export default function CourseDetailsCard({ title, setTitle, description, setDescription }) {
  return (
    <div className='card'>
      <label className='help-text'>Title</label>
      <input
        className='input-wide'
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className='help-text'>Description</label>
      <textarea
        className='input-wide'
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </div>
  );
}