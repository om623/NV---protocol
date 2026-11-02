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
  'pt-BR': {
    section: 'Leitura & evolução financeira', tailTitle: 'Prepare-se para os efeitos de cauda',
    tailQuote: 'Você pode estar errado metade das vezes e ainda assim construir uma fortuna.',
    tailBody: 'Morgan Housel explica que poucos acontecimentos raros podem determinar grande parte dos resultados. Não é preciso prever cada crise: é preciso sobreviver a elas. Resiliência, horizonte longo e margem de segurança importam mais do que previsões perfeitas.',
    practice: 'APLIQUE', tailAction: 'Evite concentração excessiva, mantenha liquidez para imprevistos, controle dívidas frágeis e não arrisque tudo em uma única oportunidade.',
    psychology: 'Ideias inspiradas em A Psicologia Financeira — Morgan Housel.',
    literacyTitle: 'Construa sua proficiência financeira',
    literacyQuote: 'Os ricos fazem o dinheiro trabalhar para eles.',
    literacyBody: 'Pai Rico, Pai Pobre incentiva a compreender a diferença entre ativos e passivos e a observar o fluxo de caixa. Proficiência financeira é aprender continuamente a ler números, avaliar riscos e tomar decisões conscientes — não buscar enriquecimento rápido.',
    literacyAction: 'Estude orçamento, juros compostos, balanços, fluxo de caixa, diversificação e investimentos. Antes de comprar um ativo, entenda como ele gera valor, quais custos possui e quais riscos pode trazer.',
    richDad: 'Ideias inspiradas em Pai Rico, Pai Pobre — Robert T. Kiyosaki.',
  },
  en: {
    section: 'Reading & financial growth', tailTitle: 'Prepare for tail events',
    tailQuote: 'You can be wrong half the time and still build a fortune.',
    tailBody: 'Morgan Housel explains that a few rare events can drive much of the outcome. You do not need to predict every crisis; you need to survive them. Resilience, a long horizon and a margin of safety matter more than perfect forecasts.',
    practice: 'PUT IT INTO PRACTICE', tailAction: 'Avoid excessive concentration, keep liquidity for surprises, manage fragile debt and never risk everything on one opportunity.',
    psychology: 'Ideas inspired by The Psychology of Money — Morgan Housel.',
    literacyTitle: 'Build financial proficiency',
    literacyQuote: 'The rich have money work for them.',
    literacyBody: 'Rich Dad Poor Dad encourages understanding assets versus liabilities and paying attention to cash flow. Financial proficiency means continually learning to read numbers, assess risk and make informed decisions—not chasing quick wealth.',
    literacyAction: 'Study budgeting, compound interest, balance sheets, cash flow, diversification and investing. Before buying an asset, understand how it creates value, its costs and its risks.',
    richDad: 'Ideas inspired by Rich Dad Poor Dad — Robert T. Kiyosaki.',
  },
  es: {
    section: 'Lectura y crecimiento financiero', tailTitle: 'Prepárate para los eventos de cola',
    tailQuote: 'Puedes equivocarte la mitad de las veces y aun así construir una fortuna.',
    tailBody: 'Morgan Housel explica que unos pocos sucesos raros pueden determinar gran parte del resultado. No necesitas predecir cada crisis: necesitas sobrevivirla. La resiliencia, el largo plazo y un margen de seguridad valen más que los pronósticos perfectos.',
    practice: 'PONLO EN PRÁCTICA', tailAction: 'Evita concentrar demasiado, conserva liquidez para imprevistos, controla las deudas frágiles y no arriesgues todo en una sola oportunidad.',
    psychology: 'Ideas inspiradas en La psicología del dinero — Morgan Housel.',
    literacyTitle: 'Desarrolla tu competencia financiera',
    literacyQuote: 'Los ricos hacen que el dinero trabaje para ellos.',
    literacyBody: 'Padre Rico, Padre Pobre anima a comprender la diferencia entre activos y pasivos y a observar el flujo de caja. La competencia financiera requiere aprender a leer cifras, evaluar riesgos y decidir con criterio, no buscar riqueza rápida.',
    literacyAction: 'Estudia presupuestos, interés compuesto, balances, flujo de caja, diversificación e inversiones. Antes de comprar un activo, comprende cómo crea valor, sus costes y sus riesgos.',
    richDad: 'Ideas inspiradas en Padre Rico, Padre Pobre — Robert T. Kiyosaki.',
  },
  fr: {
    section: 'Lecture et progression financière', tailTitle: 'Préparez-vous aux événements extrêmes',
    tailQuote: 'On peut se tromper la moitié du temps et bâtir malgré tout une fortune.',
    tailBody: 'Morgan Housel explique que quelques événements rares peuvent déterminer une grande partie du résultat. Il ne faut pas prédire chaque crise, mais pouvoir y survivre. Résilience, durée et marge de sécurité comptent davantage que des prévisions parfaites.',
    practice: 'À METTRE EN PRATIQUE', tailAction: 'Évitez la concentration excessive, gardez des liquidités pour les imprévus, maîtrisez les dettes fragiles et ne misez pas tout sur une seule occasion.',
    psychology: 'Idées inspirées de La Psychologie de l’argent — Morgan Housel.',
    literacyTitle: 'Développez votre maîtrise financière',
    literacyQuote: 'Les riches font travailler l’argent pour eux.',
    literacyBody: 'Père riche, Père pauvre invite à comprendre actifs et passifs et à suivre les flux de trésorerie. La maîtrise financière consiste à apprendre à lire les chiffres, évaluer les risques et décider avec discernement, pas à rechercher un enrichissement rapide.',
    literacyAction: 'Étudiez le budget, les intérêts composés, les bilans, la trésorerie, la diversification et l’investissement. Avant tout achat, comprenez la valeur créée, les coûts et les risques.',
    richDad: 'Idées inspirées de Père riche, Père pauvre — Robert T. Kiyosaki.',
  },
  zh: {
    section: '阅读与财务成长', tailTitle: '为尾部风险做好准备',
    tailQuote: '即使有一半时间判断错误，仍然可能积累财富。',
    tailBody: 'Morgan Housel指出，少数罕见事件可能决定大部分结果。关键不是预测每一次危机，而是有能力度过危机。韧性、长期视角和安全边际比完美预测更重要。',
    practice: '付诸实践', tailAction: '避免过度集中投资，为意外保留流动性，控制脆弱的债务，不要把全部资金押在单一机会上。',
    psychology: '灵感源自《金钱心理学》— Morgan Housel。',
    literacyTitle: '提升财务素养',
    literacyQuote: '富人让钱为自己工作。',
    literacyBody: '《富爸爸，穷爸爸》鼓励理解资产与负债的区别，并关注现金流。财务素养意味着持续学习读懂数字、评估风险并审慎决策，而不是追求快速致富。',
    literacyAction: '学习预算、复利、资产负债表、现金流、分散投资和投资基础。购买资产前，先了解其价值来源、成本与风险。',
    richDad: '灵感源自《富爸爸，穷爸爸》— Robert T. Kiyosaki。',
  },
  ja: {
    section: '読書と金融リテラ      {/* ── Financial literacy reading panel (replaces network diagnostics) ── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <BookOpen size={11} className="text-cyan-400" />
          {readingCopy[locale].section}
        </div>
        <div className="space-y-3">
          <article className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck size={14} className="text-amber-300 shrink-0" />
              <span className="text-[10px] font-semibold tracking-wide text-foreground">{readingCopy[locale].tailTitle}</span>
            </div>
            <p className="text-[10px] leading-relaxed text-amber-200/80 italic">“{readingCopy[locale].tailQuote}”</p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{readingCopy[locale].tailBody}</p>
            <div className="mt-2 border-t border-amber-400/10 pt-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-amber-300/70">{readingCopy[locale].practice}</span>
              <p className="mt-1 text-[10px] leading-relaxed text-foreground/80">{readingCopy[locale].tailAction}</p>
            </div>
            <p className="mt-2 text-[9px] text-muted-foreground/50">{readingCopy[locale].psychology}</p>
          </article>
          <article className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2">
              <GraduationCap size={14} className="text-cyan-300 shrink-0" />
              <span className="text-[10px] font-semibold tracking-wide text-foreground">{readingCopy[locale].literacyTitle}</span>
            </div>
            <p className="text-[10px] leading-relaxed text-cyan-200/80 italic">“{readingCopy[locale].literacyQuote}”</p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{readingCopy[locale].literacyBody}</p>
            <div className="mt-2 border-t border-cyan-400/10 pt-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-300/70">{readingCopy[locale].practice}</span>
              <p className="mt-1 text-[10px] leading-relaxed text-foreground/80">{readingCopy[locale].literacyAction}</p>
            </div>
            <p className="mt-2 text-[9px] text-muted-foreground/50">{readingCopy[locale].richDad}</p>
          </article>
        </div>
      </div>


    literacyBody: '『부자 아빠 가난한 아빠』는 자산과 부채의 차이를 이해하고 현금 흐름을 살피도록 권합니다. 금융 역량은 숫자를 읽고 위험을 평가하며 신중하게 결정하는 법을 계속 배우는 것입니다.',
    literacyAction: '예산, 복리, 재무상태표, 현금 흐름, 분산 투자와 투자를 공부하세요. 자산을 사기 전에 가치 창출 방식, 비용과 위험을 이해하세요.',
    richDad: '『부자 아빠 가난한 아빠』에서 영감을 받은 아이디어 — Robert T. Kiyosaki.',
  },
  hi: {
    section: 'पठन और वित्तीय विकास', tailTitle: 'अत्यंत दुर्लभ घटनाओं के लिए तैयार रहें',
    tailQuote: 'आधे समय गलत होने पर भी संपत्ति बनाई जा सकती है।',
    tailBody: 'Morgan Housel बताते हैं कि कुछ दुर्लभ घटनाएँ परिणाम का बड़ा हिस्सा तय कर सकती हैं। हर संकट की भविष्यवाणी करना जरूरी नहीं; उससे उबरने की क्षमता जरूरी है। लचीलापन, लंबी अवधि की सोच और सुरक्षा का मार्जिन सटीक पूर्वानुमान से अधिक महत्वपूर्ण हैं।',
    practice: 'व्यवहार में लाएँ', tailAction: 'अत्यधिक एकाग्र निवेश से बचें, अप्रत्याशित स्थितियों के लिए नकदी रखें, जोखिमभरे कर्ज को नियंत्रित करें और एक अवसर पर सब कुछ दाँव पर न लगाएँ।',
    psychology: 'द साइकोलॉजी ऑफ मनी से प्रेरित विचार — Morgan Housel।',
    literacyTitle: 'वित्तीय दक्षता विकसित करें',
    literacyQuote: 'अमीर लोग पैसे से अपने लिए काम करवाते हैं।',
    literacyBody: 'रिच डैड पुअर डैड संपत्ति और देनदारियों का अंतर समझने तथा नकदी प्रवाह पर ध्यान देने को प्रोत्साहित करता है। वित्तीय दक्षता का अर्थ है संख्याएँ पढ़ना, जोखिम आँकना और सोच-समझकर निर्णय लेना सीखते रहना।',
    literacyAction: 'बजट, चक्रवृद्धि ब्याज, बैलेंस शीट, नकदी प्रवाह, विविधीकरण और निवेश सीखें। कोई संपत्ति खरीदने से पहले उसका मूल्य, लागत और जोखिम समझें।',
    richDad: 'रिच डैड पुअर डैड से प्रेरित विचार — Robert T. Kiyosaki।',
  },
  ar: {
    section: 'القراءة والنمو المالي', tailTitle: 'استعد للأحداث النادرة ذات الأثر الكبير',
    tailQuote: 'يمكنك أن تخطئ نصف الوقت ومع ذلك تبني ثروة.',
    tailBody: 'يوضح Morgan Housel أن عدداً قليلاً من الأحداث النادرة قد يحدد جزءاً كبيراً من النتائج. لا تحتاج إلى توقع كل أزمة؛ بل إلى القدرة على تجاوزها. المرونة والأفق الطويل وهامش الأمان أهم من التوقعات المثالية.',
    practice: 'طبّق ذلك', tailAction: 'تجنب التركّز المفرط، واحتفظ بسيولة للطوارئ، واضبط الديون الهشة، ولا تخاطر بكل شيء في فرصة واحدة.',
    psychology: 'أفكار مستوحاة من سيكولوجية المال — Morgan Housel.',
    literacyTitle: 'طوّر كفاءتك المالية',
    literacyQuote: 'الأغنياء يجعلون المال يعمل لصالحهم.',
    literacyBody: 'يشجع كتاب الأب الغني والأب الفقير على فهم الفرق بين الأصول والالتزامات ومتابعة التدفق النقدي. الكفاءة المالية تعني مواصلة تعلم قراءة الأرقام وتقييم المخاطر واتخاذ قرارات واعية، لا مطاردة الثراء السريع.',
    literacyAction: 'تعلّم إعداد الميزانية والفائدة المركبة والميزانيات العمومية والتدفق النقدي والتنويع والاستثمار. افهم مصدر قيمة الأصل وتكاليفه ومخاطره قبل شرائه.',
    richDad: 'أفكار مستوحاة من الأب الغني والأب الفقير — Robert T. Kiyosaki.',
  },
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

      {/* ── Network Activity (preserved + enhanced stats) ─────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Radio size={11} className="text-cyan-400" />
          {t('intel.networkActivity')}
        </div>
        <div className="space-y-1">
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">{t('dash.network')}</span>
            <span className="text-foreground font-mono text-[10px]" translate="no">{activeNetwork.name}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">{t('intel.chainId')}</span>
            <span className="text-cyan-400 font-mono text-[11px]" translate="no">{activeNetwork.chainId}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">{t('intel.mode')}</span>
            <span className={`font-mono text-[11px] ${envMode === 'testnet' ? 'text-green-400' : 'text-amber-400'}`}>
              {envMode === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}
            </span>
          </div>
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
