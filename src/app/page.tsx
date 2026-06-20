import { redirect } from 'next/navigation';

export default function Home() {
  // Always redirect to dashboard, which middleware will protect
  redirect('/dashboard');
}
