import { useGameText } from './useGameText'
import { PATH_LABELS, PERSONALITY_PATHS, XP_THRESHOLDS } from '../simulation/personality'
import type { Personality } from '../simulation/personality'
export function PersonalityOverview({ personality }: { personality: Personality }) {
  const t = useGameText()
  return <section className="personality-overview" aria-label={t('Pete’s personality and XP')}>
    <h3>{t('Personality')} · {t(PATH_LABELS[personality.dominant])}</h3>
    {PERSONALITY_PATHS.map(path => {
      const { xp, level } = personality.paths[path], floor = XP_THRESHOLDS[level - 1], next = XP_THRESHOLDS[level]
      return <div key={path}>
        <div className="stats"><span>{t(PATH_LABELS[path])}{path === personality.dominant ? ' ★' : ''} · Lv {level}</span><b>{xp} XP{next !== undefined ? ` / ${next}` : ' · Max'}</b></div>
        <progress aria-label={t(`${PATH_LABELS[path]} level progress`)} max={next === undefined ? 1 : next - floor} value={next === undefined ? 1 : xp - floor} />
      </div>
    })}
    <p className="inspection-note">{t('Recent activities shape personality. All earned XP stays.')}</p>
  </section>
}
