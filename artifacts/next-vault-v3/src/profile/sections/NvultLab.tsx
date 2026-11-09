// ── Nvult Lab: build the look of your character ──────────────────────────────
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Dices, Eye, Lock, Palette, RotateCcw } from 'lucide-react';
import { useFormat, useI18n } from '../../i18n';
import { ACCENTS, BODY_STYLES, RARITY_COLOR, SLOTS, finishFor, partsFor, rarityOf, type PartDef, type SlotId } from '../nvult/catalog';
import { MAX_NAME, type Loadout } from '../nvult/loadout';
import { NvultFigure } from '../nvult/NvultFigure';
import { NvultStage } from '../nvult/NvultStage';
import { Nvult3D } from '../nvult3d/Nvult3D';
import type { RenderMode } from '../nvult3d/support';
import type { ProfileCtx } from '../types';
import { Meter, Panel, Tag, describeLook, tabKeys } from '../ui';

type Tab = SlotId | 'look';
const TABS: Tab[] = [...SLOTS, 'look'];

export function NvultLab({ ctx }: { ctx: ProfileCtx }) {
  const { t } = useI18n();
  const { number } = useFormat();
  const { gamification: g, level, accent, nv, go } = ctx;
  const [tab, setTab] = useState<Tab>('head');
  const [preview, setPreview] = useState<{ slot: SlotId; part: PartDef } | null>(null);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<RenderMode>('2d');

  const shown: Loadout = useMemo(
    () => (preview ? { ...nv.effective, [preview.slot]: preview.part.id } : nv.effective),
    [nv.effective, preview],
  );
  const finish = finishFor(g.equippedSkin);
  const signature = `${g.equippedSkin}|${shown.head}|${shown.armor}|${shown.back}|${shown.weapon}|${shown.aura}|${shown.accent}|${shown.style}`;

  function choose(slot: SlotId, part: PartDef) {
    if (level >= part.levelRequired) {
      nv.setPart(slot, part.id);
      setPreview(null);
      const name = part.id === 'none' ? t(`pf.slot.${slot}`) : t(`pf.part.${slot}.${part.id}`);
      setNote(t(part.id === 'none' ? 'pf.lab.announceCleared' : 'pf.lab.announceEquipped', { name }));
    } else {
      setPreview({ slot, part }); // locked: try it on, nothing is saved
      setNote('');
    }
  }

  return (
    <div className="grid gap-4 @2xl:grid-cols-[minmax(0,320px)_1fr]">
      {/* ── Stage ───────────────────────────────────────────────────── */}
      <Panel eyebrow={t('pf.lab.title')} right={<Tag kind="local" />}>
        <NvultStage accent={accent} changeKey={signature} announce={note} scene3d={mode === '3d'} className="aspect-[4/5] w-full"
          overlay={
            <AnimatePresence>
              {preview && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="preview-badge"
                  className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-mono text-amber-200 backdrop-blur-md">
                  <Eye size={11} /> {t('pf.lab.previewing')}
                </motion.div>
              )}
            </AnimatePresence>
          }>
          <Nvult3D look={shown} skinId={g.equippedSkin} level={level} label={describeLook(t, shown)} onMode={setMode} className="h-full w-full" />
        </NvultStage>

        <label className="mt-3 block text-[9px] font-mono uppercase tracking-[.18em] text-muted-foreground/50" htmlFor="pf-nvult-name">{t('pf.lab.name')}</label>
        <input id="pf-nvult-name" data-testid="lab-name" value={nv.loadout.name} maxLength={MAX_NAME} onChange={(e) => nv.setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground transition-colors focus:border-white/30" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { nv.reset(); setPreview(null); setNote(t('pf.lab.announceReset')); }} data-testid="lab-reset"
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/[.04] hover:text-foreground">
            <RotateCcw size={12} /> {t('pf.lab.reset')}
          </button>
          <button onClick={() => { nv.randomize(); setPreview(null); setNote(t('pf.lab.announceRandom')); }} data-testid="lab-random"
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors hover:bg-white/[.04]" style={{ borderColor: `${accent}55`, color: accent }}>
            <Dices size={12} /> {t('pf.lab.random')}
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/55">{t('pf.note.localOnly')} {t('pf.note.noCurrency')}</p>
      </Panel>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <Panel eyebrow={t('pf.lab.equipment')} className="self-start">
        <div role="tablist" aria-label={t('pf.lab.equipment')} onKeyDown={(e) => tabKeys(e, TABS, tab, (id) => { setTab(id); setPreview(null); }, 'data-lab-tab')} className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-black/25 p-1 [scrollbar-width:none]">
          {TABS.map((id) => {
            const on = tab === id;
            return (
              <button key={id} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} data-lab-tab={id} data-testid={`lab-tab-${id}`} onClick={() => { setTab(id); setPreview(null); }}
                className={`relative flex-1 cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${on ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground'}`}
                style={on ? { color: accent } : undefined}>
                {on && <motion.span layoutId="pf-lab-tab" className="absolute inset-0 rounded-lg" style={{ background: `${accent}1c`, boxShadow: `inset 0 0 0 1px ${accent}55` }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{id === 'look' ? t('pf.slot.look') : t(`pf.slot.${id}`)}</span>
              </button>
            );
          })}
        </div>

        {tab !== 'look' ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 @lg:grid-cols-3" key={tab}>
              {partsFor(tab).map((part, i) => {
                const unlocked = level >= part.levelRequired;
                const equipped = nv.effective[tab] === part.id;
                const previewing = preview?.part.id === part.id && preview.slot === tab;
                const rarity = rarityOf(part.levelRequired);
                const rc = RARITY_COLOR[rarity];
                return (
                  <motion.button key={part.id} data-testid={`part-${tab}-${part.id}`} aria-pressed={equipped} onClick={() => choose(tab, part)}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035, duration: 0.22 }} whileTap={{ scale: 0.97 }}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border p-2 text-left transition-[box-shadow,border-color,transform] hover:-translate-y-0.5"
                    style={{
                      borderColor: equipped ? `${accent}aa` : previewing ? 'rgba(252,211,77,.55)' : 'rgba(255,255,255,.08)',
                      background: equipped ? `linear-gradient(160deg, ${accent}1f, rgba(0,0,0,.25))` : 'linear-gradient(160deg, rgba(255,255,255,.04), rgba(0,0,0,.22))',
                      boxShadow: equipped ? `0 0 22px ${accent}2e, inset 0 0 0 1px ${accent}33` : undefined,
                    }}>
                    <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rc}, transparent)`, opacity: unlocked ? 0.9 : 0.35 }} />
                    <div className="relative mx-auto aspect-square w-full max-w-[96px] overflow-hidden rounded-lg" style={{ background: `radial-gradient(70% 70% at 50% 45%, ${rc}26, transparent 75%)` }}>
                      {part.id === 'none'
                        ? <div className="flex h-full items-center justify-center text-[10px] font-mono text-muted-foreground/35">—</div>
                        : <div className="h-full w-full transition-transform duration-300 group-hover:scale-110" style={{ filter: unlocked ? undefined : 'grayscale(.7) brightness(.7)' }}>
                            <NvultFigure loadout={{ ...nv.effective, [tab]: part.id }} skinId={g.equippedSkin} level={level} focus={tab} still label={t(`pf.part.${tab}.${part.id}`)} className="h-full w-full" />
                          </div>}
                      {!unlocked && <Lock size={13} className="absolute right-1.5 top-1.5 text-foreground/70" />}
                      <AnimatePresence>
                        {equipped && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: accent, color: '#04141a', boxShadow: `0 0 12px ${accent}` }}>
                            <Check size={12} strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="mt-1.5 truncate text-[11px] font-medium text-foreground">{t(`pf.part.${tab}.${part.id}`)}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] font-mono">
                      <span style={{ color: rc }}>{t(`pf.rarity.${rarity}`)}</span>
                      <span className="text-muted-foreground/55">{part.levelRequired === 0 ? t('pf.lab.free') : unlocked ? t('pf.lab.unlocked') : t('pf.lab.unlocksAt', { n: number(part.levelRequired, 0) })}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {preview && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" data-testid="preview-info">
                  <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[.06] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-amber-100">{t(`pf.part.${preview.slot}.${preview.part.id}`)}</span>
                      <span className="font-mono text-amber-200/80">{t('pf.lab.unlocksAt', { n: number(preview.part.levelRequired, 0) })}</span>
                    </div>
                    <Meter value={level / preview.part.levelRequired} color="#fcd34d" className="mt-2" />
                    <p className="mt-1.5 text-[11px] text-amber-100/70">{t('pf.lab.xpNeeded', { n: number(Math.max(0, preview.part.levelRequired - level), 1) })}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-[9px] font-mono uppercase tracking-[.18em] text-muted-foreground/50">{t('pf.lab.bodyStyle')}</div>
              <div className="grid grid-cols-3 gap-2">
                {BODY_STYLES.map((s) => {
                  const on = nv.loadout.style === s;
                  return (
                    <button key={s} data-testid={`style-${s}`} aria-pressed={on} onClick={() => { nv.setStyle(s); setNote(t('pf.lab.announceStyle', { name: t(`pf.style.${s}`) })); }}
                      className="cursor-pointer rounded-xl border p-2 text-center transition-all hover:-translate-y-0.5" style={{ borderColor: on ? `${accent}aa` : 'rgba(255,255,255,.08)', background: on ? `linear-gradient(160deg, ${accent}1f, rgba(0,0,0,.25))` : 'rgba(0,0,0,.18)', boxShadow: on ? `0 0 18px ${accent}26` : undefined }}>
                      <div className="mx-auto h-[4.5rem] w-14"><NvultFigure loadout={{ ...nv.effective, style: s, head: 'standard', armor: 'core', back: 'none', weapon: 'none', aura: 'none' }} skinId={g.equippedSkin} level={0} still label={t(`pf.style.${s}`)} className="h-full w-full" /></div>
                      <div className="text-[11px] text-foreground">{t(`pf.style.${s}`)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[.18em] text-muted-foreground/50"><Palette size={10} />{t('pf.lab.accent')}</div>
              <div className="flex flex-wrap gap-2.5">
                {ACCENTS.map((a) => {
                  const on = nv.loadout.accent === a.id;
                  return (
                    <motion.button key={a.id} data-testid={`accent-${a.id}`} aria-label={t(`pf.accent.${a.id}`)} title={t(`pf.accent.${a.id}`)} aria-pressed={on}
                      onClick={() => { nv.setAccent(a.id); setNote(t('pf.lab.announceAccent', { name: t(`pf.accent.${a.id}`) })); }} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.92 }}
                      className="h-8 w-8 cursor-pointer rounded-full border-2" style={{ background: `radial-gradient(circle at 30% 28%, #fff9, ${a.hex} 45%, ${a.hex})`, borderColor: on ? '#fff' : 'rgba(255,255,255,.12)', boxShadow: on ? `0 0 16px ${a.hex}` : undefined }} />
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-black/20 p-3">
              <div className="h-10 w-10 shrink-0 rounded-lg border border-white/10" style={{ background: `linear-gradient(135deg, ${finish.c0}, ${finish.c1} 40%, ${finish.c2} 75%, ${finish.c3})` }} />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono uppercase tracking-[.18em] text-muted-foreground/50">{t('pf.lab.finish')}</div>
                <div className="truncate text-sm font-medium text-foreground">{t(`skin.${g.equippedSkin}`)}</div>
                <p className="text-[10px] text-muted-foreground/55">{t('pf.lab.finishHint')}</p>
              </div>
              <button onClick={() => go('collection')} className="shrink-0 cursor-pointer rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">{t('pf.nav.collection')}</button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
