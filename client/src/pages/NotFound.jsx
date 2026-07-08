import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <p className="eyebrow">error 404</p>
        <h1 className="section-title">Page not found</h1>
        <p>This route doesn't exist. Head back to the start.</p>
        <Link className="btn btn-secondary" to="/">
          Go to home
        </Link>
      </div>
    </section>
  );
}
