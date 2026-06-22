import { useT } from '../i18n/LanguageContext'

const STR = {
  en: {
    setupNeeded: 'Setup needed',
    addPrefix: 'Add your',
    addSuffix: 'credentials',
    intro:
      "This app uses Supabase for sign-in and saving your settings. It can't start until you create a",
    introTail: "file in the project root with your project's credentials.",
    step1Prefix: 'In your Supabase dashboard, open',
    step1Path: 'Project Settings → API',
    step2Prefix: 'Create a file named',
    step2Mid: 'next to',
    step2Tail: 'with:',
    step3Prefix: 'Restart the dev server (',
    step3Mid: ') — Vite only reads',
    step3Tail: 'on startup.',
  },
  nl: {
    setupNeeded: 'Installatie nodig',
    addPrefix: 'Voeg je',
    addSuffix: 'inloggegevens toe',
    intro:
      'Deze app gebruikt Supabase om aan te melden en je instellingen te bewaren. Ze kan niet starten tot je een',
    introTail: 'bestand in de projectmap aanmaakt met de inloggegevens van je project.',
    step1Prefix: 'Open in je Supabase-dashboard',
    step1Path: 'Project Settings → API',
    step2Prefix: 'Maak een bestand met de naam',
    step2Mid: 'naast',
    step2Tail: 'met:',
    step3Prefix: 'Herstart de dev-server (',
    step3Mid: ') — Vite leest',
    step3Tail: 'enkel bij het opstarten.',
  },
}

/**
 * Shown when Supabase credentials are missing (no `.env`). The whole app runs
 * on Supabase for auth and per-user saving, so without credentials there is
 * nothing to render — this explains how to fix it instead of a blank page.
 */
export function SetupScreen() {
  const t = useT(STR)
  return (
    <div className="ambient flex min-h-screen items-center justify-center bg-surface px-6 py-12 text-slate-200">
      <div className="glass relative z-10 w-full max-w-xl rounded-2xl p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {t.setupNeeded}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {t.addPrefix} <span className="text-gradient">Supabase</span> {t.addSuffix}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {t.intro}{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">.env</code>{' '}
          {t.introTail}
        </p>

        <ol className="mt-6 space-y-3 text-sm text-slate-300">
          <li>
            <span className="font-semibold text-white">1.</span> {t.step1Prefix}{' '}
            <span className="text-slate-200">{t.step1Path}</span>.
          </li>
          <li>
            <span className="font-semibold text-white">2.</span> {t.step2Prefix}{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">.env</code> {t.step2Mid}{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">package.json</code>{' '}
            {t.step2Tail}
          </li>
        </ol>

        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-slate-300">
          <code>
            VITE_SUPABASE_URL=https://your-project-ref.supabase.co{'\n'}
            VITE_SUPABASE_ANON_KEY=your-anon-public-key
          </code>
        </pre>

        <p className="mt-4 text-sm text-slate-400">
          <span className="font-semibold text-white">3.</span> {t.step3Prefix}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">npm run dev</code>
          {t.step3Mid} <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">.env</code>{' '}
          {t.step3Tail}
        </p>
      </div>
    </div>
  )
}
