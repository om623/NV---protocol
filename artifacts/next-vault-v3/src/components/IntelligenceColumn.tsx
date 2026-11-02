import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader as Loader2, TrendingUp, TrendingDown, Globe, RefreshCw, Radio, RadioTower, Volume2, VolumeX, BookOpen, ShieldCheck, GraduationCap } from 'lucide-react';
import type { EnvMode, NetworkConfig } from '../networks';
import { useI18n } from '../i18n';
import {
  type MarketAsset, type MarketGroup, type TrendStatus,
  getMarketGroups, refreshGlobalMarkets, formatVolume,
} from '../lib/marketData';

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntelligenceColumnProps {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const readingCopy = {
  "pt-BR": {
    "section": "Leitura & evolução financeira",
    "tailTitle": "Prepare-se para os efeitos de cauda",
    "tailQuote": "Eventos raros podem mudar tudo.",
    "tailBody": "Morgan Housel destaca que poucos acontecimentos extremos podem responder por grande parte dos resultados. Não é necessário prever cada crise; é necessário sobreviver a elas, com resiliência, visão de longo prazo e margem de segurança.",
    "practice": "APLIQUE",
    "tailAction": "Evite concentração excessiva, mantenha liquidez para imprevistos, controle dívidas frágeis e não arrisque tudo em uma única oportunidade.",
    "psychology": "Ideias inspiradas em A Psicologia Financeira — Morgan Housel.",
    "literacyTitle": "Construa sua proficiência financeira",
    "literacyQuote": "Faça o dinheiro trabalhar para você.",
    "literacyBody": "Pai Rico, Pai Pobre incentiva a compreender ativos, passivos e fluxo de caixa. Proficiência financeira é aprender a interpretar números, avaliar riscos e tomar decisões conscientes — não buscar enriquecimento rápido.",
    "literacyAction": "Estude orçamento, juros compostos, balanços, fluxo de caixa, diversificação e investimentos. Antes de comprar um ativo, entenda como gera valor, seus custos e riscos.",
    "richDad": "Ideias inspiradas em Pai Rico, Pai Pobre — Robert T. Kiyosaki."
  },
  "en": {
    "section": "Reading & financial growth",
    "tailTitle": "Prepare for tail events",
    "tailQuote": "Rare events can change everything.",
    "tailBody": "Morgan Housel explains that a few extreme events can drive much of the outcome. You do not need to predict every crisis; you need to survive through resilience, a long-term view and a margin of safety.",
    "practice": "PUT IT INTO PRACTICE",
    "tailAction": "Avoid excessive concentration, keep liquidity for surprises, manage fragile debt and never risk everything on one opportunity.",
    "psychology": "Ideas inspired by The Psychology of Money — Morgan Housel.",
    "literacyTitle": "Build financial proficiency",
    "literacyQuote": "Make money work for you.",
    "literacyBody": "Rich Dad Poor Dad encourages understanding assets, liabilities and cash flow. Financial proficiency means learning to read numbers, assess risks and make informed decisions—not chasing quick wealth.",
    "literacyAction": "Study budgeting, compound interest, balance sheets, cash flow, diversification and investing. Understand an asset’s value, costs and risks before buying.",
    "richDad": "Ideas inspired by Rich Dad Poor Dad — Robert T. Kiyosaki."
  },
  "es": {
    "section": "Lectura y crecimiento financiero",
    "tailTitle": "Prepárate para los eventos de cola",
    "tailQuote": "Los sucesos raros pueden cambiarlo todo.",
    "tailBody": "Morgan Housel explica que unos pocos sucesos extremos pueden determinar gran parte del resultado. Necesitas resiliencia, visión a largo plazo y margen de seguridad para atravesar las crisis.",
    "practice": "PONLO EN PRÁCTICA",
    "tailAction": "Evita la concentración excesiva, conserva liquidez, controla las deudas frágiles y no arriesgues todo en una sola oportunidad.",
    "psychology": "Ideas inspiradas en La psicología del dinero — Morgan Housel.",
    "literacyTitle": "Desarrolla tu competencia financiera",
    "literacyQuote": "Haz que el dinero trabaje para ti.",
    "literacyBody": "Padre Rico, Padre Pobre anima a comprender activos, pasivos y flujo de caja. La competencia financiera consiste en interpretar cifras, evaluar riesgos y decidir con criterio.",
    "literacyAction": "Estudia presupuestos, interés compuesto, balances, flujo de caja, diversificación e inversiones. Comprende valor, costes y riesgos antes de comprar.",
    "richDad": "Ideas inspiradas en Padre Rico, Padre Pobre — Robert T. Kiyosaki."
  },
  "fr": {
    "section": "Lecture et progression financière",
    "tailTitle": "Préparez-vous aux événements extrêmes",
    "tailQuote": "Les événements rares peuvent tout changer.",
    "tailBody": "Morgan Housel explique que quelques événements extrêmes peuvent déterminer une grande partie du résultat. La résilience, une vision à long terme et une marge de sécurité aident à traverser les crises.",
    "practice": "À METTRE EN PRATIQUE",
    "tailAction": "Évitez la concentration excessive, gardez des liquidités, maîtrisez les dettes fragiles et ne misez pas tout sur une seule occasion.",
    "psychology": "Idées inspirées de La Psychologie de l’argent — Morgan Housel.",
    "literacyTitle": "Développez votre maîtrise financière",
    "literacyQuote": "Faites travailler l’argent pour vous.",
    "literacyBody": "Père riche, Père pauvre invite à comprendre actifs, passifs et flux de trésorerie. La maîtrise financière consiste à lire les chiffres, évaluer les risques et décider avec discernement.",
    "literacyAction": "Étudiez le budget, les intérêts composés, les bilans, la trésorerie, la diversification et l’investissement. Comprenez valeur, coûts et risques avant tout achat.",
    "richDad": "Idées inspirées de Père riche, Père pauvre — Robert T. Kiyosaki."
  },
  "zh": {
    "section": "阅读与财务成长",
    "tailTitle": "为尾部风险做好准备",
    "tailQuote": "罕见事件可能改变一切。",
    "tailBody": "Morgan Housel指出，少数极端事件可能决定大部分结果。重点不是预测每场危机，而是凭借韧性、长期视角和安全边际度过危机。",
    "practice": "付诸实践",
    "tailAction": "避免过度集中投资，为意外保留流动性，控制脆弱债务，不要把全部资金押在单一机会上。",
    "psychology": "灵感源自《金钱心理学》— Morgan Housel。",
    "literacyTitle": "提升财务素养",
    "literacyQuote": "让钱为自己工作。",
    "literacyBody": "《富爸爸，穷爸爸》鼓励理解资产、负债并关注现金流。财务素养意味着学习读懂数字、评估风险并审慎决策，而非追求快速致富。",
    "literacyAction": "学习预算、复利、资产负债表、现金流、分散投资和投资基础。购买前了解资产的价值来源、成本与风险。",
    "richDad": "灵感源自《富爸爸，穷爸爸》— Robert T. Kiyosaki。"
  },
  "ja": {
    "section": "読書と金融リテラシー",
    "tailTitle": "テールリスクに備える",
    "tailQuote": "まれな出来事がすべてを変えることがあります。",
    "tailBody": "Morgan Houselは少数の極端な出来事が結果を左右すると説明します。危機を予測するより、回復力、長期視点、安全余裕で乗り越えることが大切です。",
    "practice": "実践する",
    "tailAction": "過度な集中を避け、緊急時の流動性を保ち、脆弱な負債を抑え、一つの機会に全てを賭けないでください。",
    "psychology": "『サイコロジー・オブ・マネー』に着想 — Morgan Housel。",
    "literacyTitle": "金融リテラシーを高める",
    "literacyQuote": "お金に自分のために働いてもらう。",
    "literacyBody": "『金持ち父さん 貧乏父さん』は資産と負債、キャッシュフローへの理解を促します。数字を読み、リスクを評価し、慎重に判断する力を学び続けましょう。",
    "literacyAction": "家計、複利、貸借対照表、キャッシュフロー、分散投資を学び、購入前に価値、費用、リスクを確認しましょう。",
    "richDad": "『金持ち父さん 貧乏父さん』に着想 — Robert T. Kiyosaki。"
  },
  "ko": {
    "section": "독서와 금융 성장",
    "tailTitle": "꼬리 위험에 대비하세요",
    "tailQuote": "드문 사건이 모든 것을 바꿀 수 있습니다.",
    "tailBody": "Morgan Housel은 소수의 극단적 사건이 결과를 좌우할 수 있다고 설명합니다. 회복력, 장기적 관점, 안전마진으로 위기를 견뎌내는 것이 중요합니다.",
    "practice": "실천하기",
    "tailAction": "과도한 집중을 피하고 유동성을 확보하며 취약한 부채를 관리하고 한 번의 기회에 모든 것을 걸지 마세요.",
    "psychology": "『돈의 심리학』에서 영감을 받은 내용 — Morgan Housel.",
    "literacyTitle": "금융 역량을 키우세요",
    "literacyQuote": "돈이 자신을 위해 일하게 하세요.",
    "literacyBody": "『부자 아빠 가난한 아빠』는 자산과 부채의 차이, 현금 흐름의 중요성을 강조합니다. 숫자를 읽고 위험을 평가하며 신중하게 결정하는 능력을 배우세요.",
    "literacyAction": "예산, 복리, 재무상태표, 현금 흐름, 분산 투자를 공부하고 자산의 가치, 비용, 위험을 확인하세요.",
    "richDad": "『부자 아빠 가난한 아빠』에서 영감을 받은 내용 — Robert T. Kiyosaki."
  },
  "hi": {
    "section": "पठन और वित्तीय विकास",
    "tailTitle": "दुर्लभ बड़े प्रभाव वाली घटनाओं के लिए तैयार रहें",
    "tailQuote": "दुर्लभ घटनाएँ सब कुछ बदल सकती हैं।",
    "tailBody": "Morgan Housel बताते हैं कि कुछ असाधारण घटनाएँ परिणाम तय कर सकती हैं। लचीलापन, दीर्घकालिक सोच और सुरक्षा मार्जिन विकसित करें।",
    "practice": "व्यवहार में लाएँ",
    "tailAction": "अत्यधिक एकाग्र निवेश से बचें, नकदी रखें, जोखिमभरे कर्ज को नियंत्रित करें और एक अवसर पर सब कुछ दाँव पर न लगाएँ।",
    "psychology": "द साइकोलॉजी ऑफ मनी से प्रेरित विचार — Morgan Housel।",
    "literacyTitle": "वित्तीय दक्षता विकसित करें",
    "literacyQuote": "पैसे से अपने लिए काम करवाएँ।",
    "literacyBody": "रिच डैड पुअर डैड संपत्ति, देनदारियों और नकदी प्रवाह को समझने के लिए प्रेरित करता है। संख्याएँ पढ़ना, जोखिम आँकना और सोच-समझकर निर्णय लेना सीखें।",
    "literacyAction": "बजट, चक्रवृद्धि ब्याज, बैलेंस शीट, नकदी प्रवाह, विविधीकरण और निवेश सीखें। संपत्ति खरीदने से पहले मूल्य, लागत और जोखिम समझें।",
    "richDad": "रिच डैड पुअर डैड से प्रेरित विचार — Robert T. Kiyosaki।"
  },
  "ar": {
    "section": "القراءة والنمو المالي",
    "tailTitle": "استعد للأحداث النادرة ذات الأثر الكبير",
    "tailQuote": "قد تغير الأحداث النادرة كل شيء.",
    "tailBody": "يوضح Morgan Housel أن أحداثاً استثنائية قليلة قد تحدد جزءاً كبيراً من النتائج. الأهم تجاوز الأزمات بالمرونة والأفق الطويل وهامش الأمان.",
    "practice": "طبّق ذلك",
    "tailAction": "تجنب التركّز المفرط، واحتفظ بسيولة للطوارئ، واضبط الديون الهشة، ولا تخاطر بكل شيء في فرصة واحدة.",
    "psychology": "أفكار مستوحاة من سيكولوجية المال — Morgan Housel.",
    "literacyTitle": "طوّر كفاءتك المالية",
    "literacyQuote": "اجعل المال يعمل لصالحك.",
    "literacyBody": "يشجع كتاب الأب الغني والأب الفقير على فهم الأصول والالتزامات والتدفق النقدي. الكفاءة المالية تعني قراءة الأرقام وتقييم المخاطر واتخاذ قرارات واعية.",
    "literacyAction": "تعلّم الميزانية والفائدة المركبة والميزانيات العمومية والتدفق النقدي والتنويع والاستثمار. افهم قيمة الأصل وتكاليفه ومخاطره قبل شرائه.",
    "richDad": "أفكار مستوحاة من الأب الغني والأب الفقير — Robert T. Kiyosaki."
  }
} as const;

const panelCard = 'bg-card/80 border border-border/50 rounded-2xl p-4 hover:border-primary/15 transition-all duration-300 hover:shadow-[0_0_16px_rgba(0,229,188,0.04)]';
const panelLabel = 'text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5';
const fieldRow = 'flex justify-between items-center text-xs py-1';

// ─── Mini market row for global markets section ───────────────────────────────

function MarketRow({ asset }: { asset: MarketAsset }) {
  const isPositive = asset.change24h >= 0;
  const trendColor = asset.trend === 'bullish' ? 'text-emerald-400' : asset.trend === 'bearish' ? 'text-red-400' : 'text-muted-foreground';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40 transition-colors duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-primary/8 border border-primary/15 flex items-center justify-center text-[9px] font-bold text-primary font-mono shrink-0">
          {asset.symbol.slice(0, 2)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-mono font-medium text-foreground truncate" translate="no">{asset.symbol}</span>
          <span className="text-[9px] text-muted-foreground/50 truncate">{asset.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[11px] font-mono font-semibold text-foreground">
          ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString('en-US', { maximumFractionDigits: asset.decimals })}
        </span>
        <div className={`flex items-center gap-0.5 text-[9px] font-mono font-medium ${trendColor}`}>
          {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntelligenceColumn({
  envMode, activeNetwork,
}: IntelligenceColumnProps) {
  const { t, locale } = useI18n();
  const [tipIdx] = useState(() => Math.floor(Math.random() * 5));
  const [marketGroups, setMarketGroups] = useState<MarketGroup[]>(() => getMarketGroups());
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [signalMuted, setSignalMuted] = useState(true);
  const signalPlayerRef = useRef<HTMLIFrameElement | null>(null);
  const signalPlaylist = 'ipwupyxao_U,rCNIvbQ1_9A,Qn7hayZaaug';
  const marketTimer = useRef<number | null>(null);

  // YouTube may restore the viewer's saved caption preference after loading
  // each playlist item. Reapply the empty caption track without touching playback.
  useEffect(() => {
    const disableCaptions = () => {
      const player = signalPlayerRef.current?.contentWindow;
      if (!player) return;
      for (const module of ['captions', 'cc']) {
        try {
          player.postMessage(JSON.stringify({
            event: 'command',
            func: 'setOption',
            args: [module, 'track', {}],
          }), 'https://www.youtube-nocookie.com');
        } catch {
          // Caption controls must never interrupt video playback.
        }
      }
    };

    disableCaptions();
    const retryTimer = window.setInterval(disableCaptions, 2500);
    return () => window.clearInterval(retryTimer);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      refreshGlobalMarkets();
      setMarketGroups(getMarketGroups());
    }, 5000);
    return () => {
      clearInterval(iv);
      if (marketTimer.current !== null) window.clearTimeout(marketTimer.current);
    };
  }, []);

  const handleMarketRefresh = () => {
    setMarketRefreshing(true);
    refreshGlobalMarkets();
    setMarketGroups(getMarketGroups());
    if (marketTimer.current !== null) window.clearTimeout(marketTimer.current);
    marketTimer.current = window.setTimeout(() => setMarketRefreshing(false), 500);
  };

  const TIPS = [
    t('intel.tips.1'),
    t('intel.tips.2'),
    t('intel.tips.3'),
    t('intel.tips.4'),
    t('intel.tips.5'),
  ];

  return (
    <aside className="w-72 shrink-0 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden xl:flex flex-col gap-3 p-4 overflow-y-auto">

      {/* CNN technology video screen — official YouTube embed */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <RadioTower size={11} className="text-primary" />
          NV SIGNAL
          <span className="ml-auto flex items-center gap-1 text-[8px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>
        </div>
        <div className="relative aspect-video min-h-40 overflow-hidden rounded-2xl border border-primary/15 bg-black">
          <iframe
            ref={signalPlayerRef}
            title="NV Signal Technology"
            src={`https://www.youtube-nocookie.com/embed/ipwupyxao_U?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&rel=0&cc_load_policy=0&playsinline=1&loop=1&enablejsapi=1&playlist=${signalPlaylist}`}
            className="absolute -inset-[2px] h-[calc(100%+4px)] w-[calc(100%+4px)] border-0"
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <button type="button" onClick={() => {
            const nextMuted = !signalMuted;
            signalPlayerRef.current?.contentWindow?.postMessage(JSON.stringify({ event:'command', func:nextMuted?'mute':'unMute', args:[] }), 'https://www.youtube-nocookie.com');
            setSignalMuted(nextMuted);
          }} className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 rounded-full border border-primary/25 bg-black/75 px-2.5 py-1.5 text-[8px] font-mono text-primary backdrop-blur-md hover:bg-black/90" aria-label={signalMuted ? 'Ativar som do NV Signal' : 'Silenciar NV Signal'}>
            {signalMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            <span>{signalMuted ? 'SOUND' : 'MUTE'}</span>
          </button>
          <div className="absolute inset-0 z-10 pointer-events-none" />
        </div>
      </div>

      {/* ── Financial literacy reading panel ── */}
      <div className={panelCard}>
        <div className={panelLabel}><BookOpen size={11} className="text-cyan-400" />{readingCopy[locale].section}</div>
        <div className="space-y-3">
          <article className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2"><ShieldCheck size={14} className="text-amber-300 shrink-0" /><span className="text-[10px] font-semibold tracking-wide text-foreground">{readingCopy[locale].tailTitle}</span></div>
            <p className="text-[10px] leading-relaxed text-amber-200/80 italic">“{readingCopy[locale].tailQuote}”</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{readingCopy[locale].tailBody}</p>
            <div className="mt-2 border-t border-amber-400/10 pt-2"><span className="text-[9px] font-mono uppercase tracking-wider text-amber-300/70">{readingCopy[locale].practice}</span><p className="mt-1 text-[10px] leading-relaxed text-foreground/80">{readingCopy[locale].tailAction}</p></div>
            <p className="mt-2 text-[9px] text-muted-foreground/50">{readingCopy[locale].psychology}</p>
          </article>
          <article className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2"><GraduationCap size={14} className="text-cyan-300 shrink-0" /><span className="text-[10px] font-semibold tracking-wide text-foreground">{readingCopy[locale].literacyTitle}</span></div>
            <p className="text-[10px] leading-relaxed text-cyan-200/80 italic">“{readingCopy[locale].literacyQuote}”</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{readingCopy[locale].literacyBody}</p>
            <div className="mt-2 border-t border-cyan-400/10 pt-2"><span className="text-[9px] font-mono uppercase tracking-wider text-cyan-300/70">{readingCopy[locale].practice}</span><p className="mt-1 text-[10px] leading-relaxed text-foreground/80">{readingCopy[locale].literacyAction}</p></div>
            <p className="mt-2 text-[9px] text-muted-foreground/50">{readingCopy[locale].richDad}</p>
          </article>
        </div>
      </div>

      {/* ── NV Tip (preserved) ────────────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 hover:border-primary/25 transition-all duration-300">
        <div className={panelLabel + ' !text-primary/60'}>
          <Zap size={11} className="text-primary" />
          {t('intel.nvTip')}
        </div>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed font-mono">{TIPS[tipIdx]}</p>
      </div>

      {/* ── Global Markets (enhanced, preserved functionality) ────────────── */}
      <div className={panelCard}>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-3 -mt-1" />
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-primary" />
            <span className="text-sm font-semibold text-foreground tracking-wide">{t('intel.globalMarkets')}</span>
          </div>
          <button onClick={handleMarketRefresh} disabled={marketRefreshing}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
            {marketRefreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto scrollbar-hide pr-0.5">
          {marketGroups.map(group => (
            <div key={group.id} className="flex flex-col gap-1">
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 px-2 pt-1 pb-0.5">{group.label}</div>
              {group.assets.map(asset => <MarketRow key={asset.symbol} asset={asset} />)}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
          <span>{t('intel.autoEvery5s')}</span>
          <span className="ml-auto">LIVE SOURCES</span>
        </div>
      </div>
    </aside>
  );
}
