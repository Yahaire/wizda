import { APP_NAME } from './app.constants';

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>{APP_NAME}</h1>
      <p>Hello world. The interface comes once the API is ready.</p>
    </main>
  );
}
