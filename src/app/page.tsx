import Link from 'next/link';
export default function Home() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Family Calendar</h1>
        <p className="mt-1 opacity-80">Bare-bones but beautiful. Week view is ready.</p>
        <Link href="/calendar" className="mt-4 inline-block rounded-lg border border-white/10 bg-white/10 px-3 py-2 hover:bg-white/20">
          Open Calendar
        </Link>
      </div>
    </main>
  );
}
