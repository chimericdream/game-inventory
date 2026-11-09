import { NotFoundContent } from '@/components/NotFoundContent';

/** Inside the app shell, so it must not add a second `<main>`. */
export default function AppNotFound() {
  return <NotFoundContent inShell />;
}
