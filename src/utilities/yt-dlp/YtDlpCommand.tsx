import { useState } from 'react'
import { SaveStatus } from '../../components/SaveStatus'
import { useUtilityConfig } from '../../hooks/useUtilityConfig'
import { useT } from '../../i18n/LanguageContext'

/**
 * yt-dlp command generator.
 *
 * yt-dlp is a Python CLI that downloads media by acting as a non-browser HTTP
 * client — something a browser-only app cannot do, since cross-origin reads of
 * sites like YouTube are blocked by CORS. So this tool does NOT download
 * anything itself: it builds the exact `yt-dlp` command from the chosen options
 * for the user to copy and run locally. Pure string-building, no network calls.
 *
 * Option preferences persist via useUtilityConfig; the URL stays ephemeral.
 */

type Mode = 'video' | 'audio'

type Options = {
  mode: Mode
  videoQuality: string
  forceMp4: boolean
  audioFormat: string
  downloadSubs: boolean
  embedSubs: boolean
  autoSubs: boolean
  subLangs: string
  embedThumbnail: boolean
  embedMetadata: boolean
  embedChapters: boolean
  sponsorblock: boolean
  playlist: 'single' | 'full'
  restrictFilenames: boolean
  cookiesBrowser: string
  outputTemplate: string
  rateLimit: string
}

const DEFAULTS: Options = {
  mode: 'video',
  videoQuality: 'best',
  forceMp4: false,
  audioFormat: 'mp3',
  downloadSubs: false,
  embedSubs: false,
  autoSubs: false,
  subLangs: 'en',
  embedThumbnail: false,
  embedMetadata: false,
  embedChapters: false,
  sponsorblock: false,
  playlist: 'single',
  restrictFilenames: false,
  cookiesBrowser: '',
  outputTemplate: '',
  rateLimit: '',
}

const VIDEO_QUALITIES: { id: string; label: string }[] = [
  { id: 'best', label: 'Best available' },
  { id: '2160', label: '4K · 2160p' },
  { id: '1440', label: '1440p' },
  { id: '1080', label: '1080p' },
  { id: '720', label: '720p' },
  { id: '480', label: '480p' },
  { id: '360', label: '360p' },
]

const AUDIO_FORMATS: { id: string; label: string }[] = [
  { id: 'mp3', label: 'MP3' },
  { id: 'm4a', label: 'M4A / AAC' },
  { id: 'opus', label: 'Opus' },
  { id: 'flac', label: 'FLAC' },
  { id: 'wav', label: 'WAV' },
  { id: 'best', label: 'Best (no convert)' },
]

// A small, recognizable subset of the 1800+ sites yt-dlp can extract from.
// The full, authoritative list lives on the yt-dlp supported-sites page.
const POPULAR_SITES: string[] = [
  'YouTube',
  'Vimeo',
  'TikTok',
  'Instagram',
  'Facebook',
  'X / Twitter',
  'Twitch',
  'Reddit',
  'SoundCloud',
  'Bandcamp',
  'Dailymotion',
  'BBC iPlayer',
]

const BROWSERS: { id: string; label: string }[] = [
  { id: '', label: 'None' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'edge', label: 'Edge' },
  { id: 'safari', label: 'Safari' },
  { id: 'brave', label: 'Brave' },
]

const STR = {
  en: {
    loading: 'Loading your settings…',
    title: 'Video Downloader',
    introBefore: 'Build a ready-to-run ',
    introAfter:
      ' command from your options, then copy it and run it in your terminal. Nothing is downloaded here — the actual fetching happens locally on your machine.',
    urlLabel: 'Video / playlist URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=…',
    whatToDownload: 'What to download',
    optVideo: 'Video',
    optAudioOnly: 'Audio only',
    maxQuality: 'Max quality',
    qualityBest: 'Best available',
    preferMp4: 'Prefer MP4 (most compatible)',
    audioFormat: 'Audio format',
    audioBest: 'Best (no convert)',
    browserNone: 'None',
    subtitles: 'Subtitles',
    downloadSubs: 'Download subtitles',
    autoSubs: 'Include auto-generated subtitles',
    embedSubs: 'Embed subtitles into the file',
    subLangsLabel: 'Languages (comma-separated, or “all”)',
    subLangsPlaceholder: 'en,fr,nl',
    extras: 'Extras',
    embedThumbnail: 'Embed thumbnail / cover art',
    embedMetadata: 'Embed title, artist & metadata',
    embedChapters: 'Embed chapters',
    sponsorblock: 'Remove sponsor segments (SponsorBlock)',
    advanced: 'Advanced',
    playlists: 'Playlists',
    playlistSingle: 'Single video only',
    playlistFull: 'Whole playlist',
    cookiesLabel: 'Use cookies from browser (for private / age-gated)',
    outputTemplateLabel: 'Output filename template',
    speedLimitLabel: 'Speed limit',
    restrictFilenames: 'Restrict filenames to ASCII (no spaces / special chars)',
    command: 'Command',
    copy: 'Copy',
    copied: 'Copied!',
    enterUrlHint: 'Enter a URL above to drop it into the command.',
    firstTime: 'First time?',
    installBefore: 'Install yt-dlp first — e.g. ',
    installMacos: ' (macOS), ',
    installAnyOs: ' (any OS), or grab a binary from the ',
    releasesPage: 'releases page',
    installAfter: '. Audio conversion and embedding also need ',
    installFfmpeg: ' installed. Only download content you have the right to.',
    supportedSites: 'Supported sites',
    supportedSitesIntro:
      'Works with YouTube and over 1,800 other sites — a few popular ones:',
    fullListLink: 'See the full list of supported sites →',
  },
  nl: {
    loading: 'Je instellingen laden…',
    title: 'Video-downloader',
    introBefore: 'Stel een kant-en-klaar ',
    introAfter:
      '-commando samen op basis van je opties, kopieer het en voer het uit in je terminal. Hier wordt niets gedownload — het echte ophalen gebeurt lokaal op je eigen machine.',
    urlLabel: 'Video- / afspeellijst-URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=…',
    whatToDownload: 'Wat downloaden',
    optVideo: 'Video',
    optAudioOnly: 'Enkel audio',
    maxQuality: 'Maximale kwaliteit',
    qualityBest: 'Best beschikbaar',
    preferMp4: 'Voorkeur voor MP4 (meest compatibel)',
    audioFormat: 'Audioformaat',
    audioBest: 'Beste (geen conversie)',
    browserNone: 'Geen',
    subtitles: 'Ondertitels',
    downloadSubs: 'Ondertitels downloaden',
    autoSubs: 'Automatisch gegenereerde ondertitels meenemen',
    embedSubs: 'Ondertitels in het bestand insluiten',
    subLangsLabel: 'Talen (kommagescheiden, of “all”)',
    subLangsPlaceholder: 'en,fr,nl',
    extras: 'Extra’s',
    embedThumbnail: 'Thumbnail / hoesafbeelding insluiten',
    embedMetadata: 'Titel, artiest & metadata insluiten',
    embedChapters: 'Hoofdstukken insluiten',
    sponsorblock: 'Sponsorfragmenten verwijderen (SponsorBlock)',
    advanced: 'Geavanceerd',
    playlists: 'Afspeellijsten',
    playlistSingle: 'Alleen losse video',
    playlistFull: 'Volledige afspeellijst',
    cookiesLabel: 'Cookies uit browser gebruiken (voor privé / leeftijdsgebonden)',
    outputTemplateLabel: 'Sjabloon voor bestandsnaam',
    speedLimitLabel: 'Snelheidslimiet',
    restrictFilenames: 'Bestandsnamen beperken tot ASCII (geen spaties / speciale tekens)',
    command: 'Commando',
    copy: 'Kopiëren',
    copied: 'Gekopieerd!',
    enterUrlHint: 'Voer hierboven een URL in om die in het commando te plaatsen.',
    firstTime: 'Eerste keer?',
    installBefore: 'Installeer eerst yt-dlp — bv. ',
    installMacos: ' (macOS), ',
    installAnyOs: ' (elk OS), of pak een binary van de ',
    releasesPage: 'releases-pagina',
    installAfter: '. Audioconversie en insluiten vereisen ook ',
    installFfmpeg: '. Download alleen content waarop je recht hebt.',
    supportedSites: 'Ondersteunde sites',
    supportedSitesIntro:
      'Werkt met YouTube en meer dan 1.800 andere sites — enkele populaire:',
    fullListLink: 'Bekijk de volledige lijst met ondersteunde sites →',
  },
}

/**
 * Wrap a value in single quotes for a POSIX shell, escaping any embedded
 * single quotes. Used for the URL, output template and rate limit so that
 * spaces and shell metacharacters can't break or inject into the command.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Build the `-f` format selector for the chosen video quality. */
function videoFormat(quality: string, forceMp4: boolean): string {
  if (quality === 'best') {
    return forceMp4
      ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
      : 'bestvideo+bestaudio/best'
  }
  const h = `[height<=${quality}]`
  return forceMp4
    ? `bestvideo${h}[ext=mp4]+bestaudio[ext=m4a]/best${h}[ext=mp4]/best${h}`
    : `bestvideo${h}+bestaudio/best${h}`
}

function buildCommand(o: Options, url: string): string {
  const args: string[] = ['yt-dlp']

  if (o.mode === 'audio') {
    args.push('-x') // --extract-audio
    if (o.audioFormat !== 'best') args.push(`--audio-format ${o.audioFormat}`)
    args.push('--audio-quality 0') // best within the chosen format
  } else {
    args.push(`-f ${shellQuote(videoFormat(o.videoQuality, o.forceMp4))}`)
    if (o.forceMp4) args.push('--merge-output-format mp4')
  }

  if (o.downloadSubs || o.autoSubs) {
    if (o.downloadSubs) args.push('--write-subs')
    if (o.autoSubs) args.push('--write-auto-subs')
    args.push(`--sub-langs ${shellQuote(o.subLangs || 'en')}`)
    if (o.embedSubs) args.push('--embed-subs')
  }

  if (o.embedThumbnail) args.push('--embed-thumbnail')
  if (o.embedMetadata) args.push('--embed-metadata')
  if (o.embedChapters) args.push('--embed-chapters')
  if (o.sponsorblock) args.push('--sponsorblock-remove all')

  // yt-dlp follows playlists by default when given a playlist/channel URL.
  args.push(o.playlist === 'full' ? '--yes-playlist' : '--no-playlist')

  if (o.restrictFilenames) args.push('--restrict-filenames')
  if (o.cookiesBrowser) args.push(`--cookies-from-browser ${o.cookiesBrowser}`)
  if (o.rateLimit.trim()) args.push(`--limit-rate ${shellQuote(o.rateLimit.trim())}`)
  if (o.outputTemplate.trim()) args.push(`-o ${shellQuote(o.outputTemplate.trim())}`)

  args.push(url.trim() ? shellQuote(url.trim()) : "'<URL>'")

  return args.join(' ')
}

const inputClass =
  'glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

const labelClass = 'block text-xs font-medium text-slate-400'

function Field({
  label,
  group,
  children,
}: {
  label: string
  group?: boolean
  children: React.ReactNode
}) {
  const content = (
    <>
      <span className={labelClass}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </>
  )
  return group ? (
    <div className="block" role="group" aria-label={label}>
      {content}
    </div>
  ) : (
    <label className="block">{content}</label>
  )
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-indigo-500"
      />
      {children}
    </label>
  )
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
            value === opt.id
              ? 'bg-indigo-500 text-white'
              : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function YtDlpCommand() {
  const t = useT(STR)
  const { config, setConfig, loading, saving } = useUtilityConfig('yt-dlp', DEFAULTS)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  if (loading) {
    return <p className="animate-pulse text-slate-400">{t.loading}</p>
  }

  const o = config
  const command = buildCommand(o, url)

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <SaveStatus saving={saving} />
      </div>
      <p className="mt-2 text-slate-400">
        {t.introBefore}
        <a
          href="https://github.com/yt-dlp/yt-dlp"
          target="_blank"
          rel="noreferrer"
          className="text-indigo-300 transition-colors hover:text-indigo-200"
        >
          yt-dlp
        </a>
        {t.introAfter}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(300px,420px)]">
        <div className="min-w-0 space-y-6">
          <Field label={t.urlLabel}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.urlPlaceholder}
              className={inputClass}
            />
          </Field>

          <Field group label={t.whatToDownload}>
            <Pills<Mode>
              options={[
                { id: 'video', label: t.optVideo },
                { id: 'audio', label: t.optAudioOnly },
              ]}
              value={o.mode}
              onChange={(v) => setConfig({ mode: v })}
            />
          </Field>

          {o.mode === 'video' ? (
            <>
              <Field group label={t.maxQuality}>
                <Pills
                  options={VIDEO_QUALITIES.map((q) =>
                    q.id === 'best' ? { ...q, label: t.qualityBest } : q,
                  )}
                  value={o.videoQuality}
                  onChange={(v) => setConfig({ videoQuality: v })}
                />
              </Field>
              <Toggle checked={o.forceMp4} onChange={(v) => setConfig({ forceMp4: v })}>
                {t.preferMp4}
              </Toggle>
            </>
          ) : (
            <Field group label={t.audioFormat}>
              <Pills
                options={AUDIO_FORMATS.map((a) =>
                  a.id === 'best' ? { ...a, label: t.audioBest } : a,
                )}
                value={o.audioFormat}
                onChange={(v) => setConfig({ audioFormat: v })}
              />
            </Field>
          )}

          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {t.subtitles}
            </p>
            <div className="mt-4 space-y-3">
              <Toggle checked={o.downloadSubs} onChange={(v) => setConfig({ downloadSubs: v })}>
                {t.downloadSubs}
              </Toggle>
              <Toggle checked={o.autoSubs} onChange={(v) => setConfig({ autoSubs: v })}>
                {t.autoSubs}
              </Toggle>
              <Toggle
                checked={o.embedSubs}
                onChange={(v) => setConfig({ embedSubs: v })}
              >
                {t.embedSubs}
              </Toggle>
              {(o.downloadSubs || o.autoSubs) && (
                <Field label={t.subLangsLabel}>
                  <input
                    value={o.subLangs}
                    onChange={(e) => setConfig({ subLangs: e.target.value })}
                    placeholder={t.subLangsPlaceholder}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {t.extras}
            </p>
            <div className="mt-4 space-y-3">
              <Toggle
                checked={o.embedThumbnail}
                onChange={(v) => setConfig({ embedThumbnail: v })}
              >
                {t.embedThumbnail}
              </Toggle>
              <Toggle
                checked={o.embedMetadata}
                onChange={(v) => setConfig({ embedMetadata: v })}
              >
                {t.embedMetadata}
              </Toggle>
              <Toggle
                checked={o.embedChapters}
                onChange={(v) => setConfig({ embedChapters: v })}
              >
                {t.embedChapters}
              </Toggle>
              <Toggle
                checked={o.sponsorblock}
                onChange={(v) => setConfig({ sponsorblock: v })}
              >
                {t.sponsorblock}
              </Toggle>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {t.advanced}
            </p>
            <div className="mt-4 space-y-4">
              <Field group label={t.playlists}>
                <Pills
                  options={[
                    { id: 'single', label: t.playlistSingle },
                    { id: 'full', label: t.playlistFull },
                  ]}
                  value={o.playlist}
                  onChange={(v) => setConfig({ playlist: v })}
                />
              </Field>
              <Field group label={t.cookiesLabel}>
                <Pills
                  options={BROWSERS.map((b) =>
                    b.id === '' ? { ...b, label: t.browserNone } : b,
                  )}
                  value={o.cookiesBrowser}
                  onChange={(v) => setConfig({ cookiesBrowser: v })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.outputTemplateLabel}>
                  <input
                    value={o.outputTemplate}
                    onChange={(e) => setConfig({ outputTemplate: e.target.value })}
                    placeholder="%(title)s.%(ext)s"
                    className={inputClass}
                  />
                </Field>
                <Field label={t.speedLimitLabel}>
                  <input
                    value={o.rateLimit}
                    onChange={(e) => setConfig({ rateLimit: e.target.value })}
                    placeholder="2M"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Toggle
                checked={o.restrictFilenames}
                onChange={(v) => setConfig({ restrictFilenames: v })}
              >
                {t.restrictFilenames}
              </Toggle>
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                {t.command}
              </p>
              <button
                onClick={copy}
                className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                {copied ? t.copied : t.copy}
              </button>
            </div>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 font-mono text-xs leading-relaxed text-emerald-200">
              {command}
            </pre>
            {!url.trim() && (
              <p className="mt-3 text-xs text-slate-500">{t.enterUrlHint}</p>
            )}
          </div>

          <div className="glass mt-4 rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {t.firstTime}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {t.installBefore}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                brew install yt-dlp
              </code>
              {t.installMacos}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                pipx install yt-dlp
              </code>
              {t.installAnyOs}
              <a
                href="https://github.com/yt-dlp/yt-dlp/releases"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-300 transition-colors hover:text-indigo-200"
              >
                {t.releasesPage}
              </a>
              {t.installAfter}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                ffmpeg
              </code>
              {t.installFfmpeg}
            </p>
          </div>

          <div className="glass mt-4 rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {t.supportedSites}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {t.supportedSitesIntro}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {POPULAR_SITES.map((site) => (
                <span
                  key={site}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
                >
                  {site}
                </span>
              ))}
            </div>
            <a
              href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-indigo-300 transition-colors hover:text-indigo-200"
            >
              {t.fullListLink}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}


/*
On wiring it to a proxy backend later

Server-side: the backend already knows how to run yt-dlp; you'd send it the same options object (not the assembled string — never pass a shell string to a server). Better yet, translate options into a yt-dlp argument array server-side and spawn the process with execFile-style args (no shell), so there's zero shell-injection surface. The current shellQuote logic is only for the human-copy case.
UI: add a "Download here" button next to "Copy" that POSTs the options and streams progress back. The builder page stays useful as the manual/offline path either way.
Two things worth flagging for that future backend, since they're the real reasons a proxy is needed and also its main risks:

It's an open relay if unauthenticated. A backend that fetches arbitrary user-supplied URLs is an SSRF vector and an abuse magnet (people will point it at anything). You'd want auth, allow-listed domains or rate limits, and URL validation.
Resource cost — yt-dlp spawns ffmpeg, uses real CPU/disk/bandwidth, and downloads can be large. That's a different operational profile than your current static SPA.
So: the client tool stands on its own today, and the refactor to add a backend later is small and already anticipated. Happy to sketch the backend (and the args-array translation) when you want to go there.
*/