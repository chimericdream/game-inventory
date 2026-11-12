import Link from 'next/link';

export default function NotFound() {
  return (
    <section style={{ maxWidth: 1160, margin: '0 auto', padding: '96px 20px 0' }}>
      <h1>This shelf is empty.</h1>
      <p style={{ fontSize: 20, color: 'var(--app-muted)', maxWidth: '40ch' }}>
        There is no page here. Head back to the front of the house.
      </p>
      <p>
        <Link href="/" className="btn">
          Back to the home page
        </Link>
      </p>
    </section>
  );
}
