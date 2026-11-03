import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, Bookmark, BookmarkCheck, Building2, ChevronRight,
  Factory, Globe, Layers3, MapPin, Radar, Search, ShieldCheck, Sparkles, Star,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';

type RegionId = 'north-america' | 'south-america' | 'europe' | 'africa' | 'middle-east' | 'asia-pacific';
type SectorId = 'technology' | 'ai' | 'energy' | 'materials' | 'agribusiness' | 'mobility' | 'health' | 'finance' | 'industry' | 'aerospace';

const regions: { id: RegionId; x: number; y: number; companies: number; sectors: SectorId[] }[] = [
  { id: 'north-america', x: 27, y: 35, companies: 4, sectors: ['technology', 'ai', 'finance', 'energy'] },
  { id: 'south-america', x: 38, y: 69, companies: 3, sectors: ['agribusiness', 'energy', 'materials'] },
  { id: 'europe', x: 53, y: 31, companies: 3, sectors: ['industry', 'health', 'mobility'] },
  { id: 'africa', x: 55, y: 60, companies: 1, sectors: ['energy', 'materials', 'agribusiness'] },
  { id: 'middle-east', x: 63, y: 48, companies: 1, sectors: ['energy', 'materials'] },
  { id: 'asia-pacific', x: 77, y: 40, companies: 4, sectors: ['technology', 'ai', 'mobility', 'industry'] },
];

const companies = [
  { name: 'NVIDIA', country: 'United States', region: 'north-america' as RegionId, sector: 'ai' as SectorId, ticker: 'NVDA', listed: true },
  { name: 'Microsoft', country: 'United States', region: 'north-america' as RegionId, sector: 'technology' as SectorId, ticker: 'MSFT', listed: true },
  { name: 'TSMC', country: 'Taiwan', region: 'asia-pacific' as RegionId, sector: 'technology' as SectorId, ticker: 'TSM', listed: true },
  { name: 'Toyota', country: 'Japan', region: 'asia-pacific' as RegionId, sector: 'mobility' as SectorId, ticker: 'TM', listed: true },
  { name: 'CATL', country: 'China', region: 'asia-pacific' as RegionId, sector: 'industry' as SectorId, ticker: '300750.SZ', listed: true },
  { name: 'Siemens', country: 'Germany', region: 'europe' as RegionId, sector: 'industry' as SectorId, ticker: 'SIE', listed: true },
  { name: 'Novo Nordisk', country: 'Denmark', region: 'europe' as RegionId, sector: 'health' as SectorId, ticker: 'NOVO-B', listed: true },
  { name: 'Petrobras', country: 'Brazil', region: 'south-america' as RegionId, sector: 'energy' as SectorId, ticker: 'PETR4', listed: true },
  { name: 'Vale', country: 'Brazil', region: 'south-america' as RegionId, sector: 'materials' as SectorId, ticker: 'VALE3', listed: true },
  { name: 'Embraer', country: 'Brazil', region: 'south-america' as RegionId, sector: 'aerospace' as SectorId, ticker: 'EMBR3', listed: true },
  { name: 'Schneider Electric', country: 'France', region: 'europe' as RegionId, sector: 'industry' as SectorId, ticker: 'SU', listed: true },
  { name: 'Saudi Aramco', country: 'Saudi Arabia', region: 'middle-east' as RegionId, sector: 'energy' as SectorId, ticker: '2222', listed: true },
  { name: 'Safaricom', country: 'Kenya', region: 'africa' as RegionId, sector: 'technology' as SectorId, ticker: 'SCOM', listed: true },
];

const sectors: SectorId[] = ['technology', 'ai', 'energy', 'materials', 'agribusiness', 'mobility', 'health', 'finance', 'industry', 'aerospace'];

const copy: Record<string, Record<string, string>> = {
  'pt-BR': {
    title: 'RADAR GLOBAL', subtitle: 'Inteligência empresarial e setorial', overview: 'Visão geral', industries: 'Setores', companies: 'Empresas', watchlist: 'Observação',
    globalMap: 'Mapa empresarial global', mapHint: 'Selecione um ponto para explorar uma região', regions: 'Regiões monitoradas', companiesRef: 'Empresas de referência', sectorsTracked: 'Setores catalogados',
    sectorFocus: 'Foco setorial', explore: 'Explorar setor', allRegions: 'Todas as regiões', search: 'Buscar empresa ou ticker...', add: 'Adicionar', remove: 'Remover', saved: 'Na sua lista', empty: 'Sua lista ainda está vazia.', emptyHint: 'Adicione empresas para acompanhá-las neste espaço.',
    listed: 'Capital aberto', private: 'Capital fechado', profile: 'Perfil em preparação', noResults: 'Nenhuma empresa encontrada.', directory: 'Diretório empresarial', watchHint: 'Empresas que você deseja estudar ou acompanhar.',
    signals: 'Temas para investigar', signalsHint: 'Linhas de pesquisa setorial — não representam sinais de compra ou recomendações.', signal1: 'Infraestrutura para inteligência artificial', signal2: 'Transição energética e redes elétricas', signal3: 'Semicondutores e manufatura avançada', signal4: 'Biotecnologia e saúde de precisão',
    dataNote: 'Base inicial de referência. Indicadores financeiros, notícias e tendências em tempo real serão integrados em etapas, sempre com fontes identificadas.', regionCompanies: 'Empresas no catálogo', regionSectors: 'Setores presentes', disclaimer: 'Conteúdo informativo. Não constitui recomendação de investimento.',
    'north-america': 'América do Norte', 'south-america': 'América do Sul', europe: 'Europa', africa: 'África', 'middle-east': 'Oriente Médio', 'asia-pacific': 'Ásia-Pacífico',
    technology: 'Tecnologia', ai: 'Inteligência artificial', energy: 'Energia', materials: 'Mineração e materiais', agribusiness: 'Agronegócio', mobility: 'Mobilidade e automotivo', health: 'Saúde e biotecnologia', finance: 'Financeiro', industry: 'Indústria e automação', aerospace: 'Aeroespacial',
  },
  en: {
    title: 'GLOBAL RADAR', subtitle: 'Business and sector intelligence', overview: 'Overview', industries: 'Industries', companies: 'Companies', watchlist: 'Watchlist',
    globalMap: 'Global business map', mapHint: 'Select a point to explore a region', regions: 'Regions monitored', companiesRef: 'Reference companies', sectorsTracked: 'Catalogued sectors',
    sectorFocus: 'Sector focus', explore: 'Explore sector', allRegions: 'All regions', search: 'Search company or ticker...', add: 'Add', remove: 'Remove', saved: 'In your list', empty: 'Your watchlist is empty.', emptyHint: 'Add companies to follow them here.',
    listed: 'Public company', private: 'Private company', profile: 'Profile in preparation', noResults: 'No companies found.', directory: 'Business directory', watchHint: 'Companies you want to study or follow.',
    signals: 'Themes to investigate', signalsHint: 'Sector research themes — not buy signals or investment recommendations.', signal1: 'Artificial intelligence infrastructure', signal2: 'Energy transition and power grids', signal3: 'Semiconductors and advanced manufacturing', signal4: 'Biotechnology and precision health',
    dataNote: 'Initial reference catalogue. Financial metrics, news and live trends will be integrated in stages, with clearly identified sources.', regionCompanies: 'Companies in catalogue', regionSectors: 'Sectors represented', disclaimer: 'Informational content. Not investment advice.',
    'north-america': 'North America', 'south-america': 'South America', europe: 'Europe', africa: 'Africa', 'middle-east': 'Middle East', 'asia-pacific': 'Asia-Pacific',
    technology: 'Technology', ai: 'Artificial intelligence', energy: 'Energy', materials: 'Mining and materials', agribusiness: 'Agribusiness', mobility: 'Mobility and automotive', health: 'Healthcare and biotech', finance: 'Financial services', industry: 'Industry and automation', aerospace: 'Aerospace',
  },
  es: {
    title: 'RADAR GLOBAL', subtitle: 'Inteligencia empresarial y sectorial', overview: 'Resumen', industries: 'Sectores', companies: 'Empresas', watchlist: 'Seguimiento',
    globalMap: 'Mapa empresarial global', mapHint: 'Seleccione un punto para explorar una región', regions: 'Regiones monitorizadas', companiesRef: 'Empresas de referencia', sectorsTracked: 'Sectores catalogados',
    sectorFocus: 'Enfoque sectorial', explore: 'Explorar sector', allRegions: 'Todas las regiones', search: 'Buscar empresa o ticker...', add: 'Añadir', remove: 'Quitar', saved: 'En tu lista', empty: 'Tu lista está vacía.', emptyHint: 'Añade empresas para seguirlas aquí.',
    listed: 'Empresa cotizada', private: 'Empresa privada', profile: 'Perfil en preparación', noResults: 'No se encontraron empresas.', directory: 'Directorio empresarial', watchHint: 'Empresas que deseas estudiar o seguir.',
    signals: 'Temas para investigar', signalsHint: 'Temas de investigación sectorial; no son señales de compra ni recomendaciones.', signal1: 'Infraestructura para inteligencia artificial', signal2: 'Transición energética y redes eléctricas', signal3: 'Semiconductores y fabricación avanzada', signal4: 'Biotecnología y salud de precisión',
    dataNote: 'Catálogo inicial de referencia. Los indicadores financieros, noticias y tendencias en tiempo real se integrarán por etapas, con fuentes identificadas.', regionCompanies: 'Empresas en catálogo', regionSectors: 'Sectores representados', disclaimer: 'Contenido informativo. No constituye asesoramiento de inversión.',
    'north-america': 'América del Norte', 'south-america': 'América del Sur', europe: 'Europa', africa: 'África', 'middle-east': 'Oriente Medio', 'asia-pacific': 'Asia-Pacífico',
    technology: 'Tecnología', ai: 'Inteligencia artificial', energy: 'Energía', materials: 'Minería y materiales', agribusiness: 'Agronegocio', mobility: 'Movilidad y automoción', health: 'Salud y biotecnología', finance: 'Finanzas', industry: 'Industria y automatización', aerospace: 'Aeroespacial',
  },
  fr: {
    title: 'RADAR MONDIAL', subtitle: 'Intelligence des entreprises et des secteurs', overview: 'Vue générale', industries: 'Secteurs', companies: 'Entreprises', watchlist: 'Suivi',
    globalMap: 'Carte mondiale des entreprises', mapHint: 'Sélectionnez un point pour explorer une région', regions: 'Régions suivies', companiesRef: 'Entreprises de référence', sectorsTracked: 'Secteurs répertoriés',
    sectorFocus: 'Focus sectoriel', explore: 'Explorer le secteur', allRegions: 'Toutes les régions', search: 'Rechercher une entreprise ou un ticker...', add: 'Ajouter', remove: 'Retirer', saved: 'Dans votre liste', empty: 'Votre liste est vide.', emptyHint: 'Ajoutez des entreprises pour les suivre ici.',
    listed: 'Société cotée', private: 'Société privée', profile: 'Profil en préparation', noResults: 'Aucune entreprise trouvée.', directory: 'Répertoire des entreprises', watchHint: 'Entreprises que vous souhaitez étudier ou suivre.',
    signals: 'Thèmes à explorer', signalsHint: 'Axes de recherche sectorielle, pas des signaux d’achat ni des recommandations.', signal1: 'Infrastructure pour l’intelligence artificielle', signal2: 'Transition énergétique et réseaux électriques', signal3: 'Semi-conducteurs et fabrication avancée', signal4: 'Biotechnologie et santé de précision',
    dataNote: 'Catalogue de référence initial. Les données financières, actualités et tendances en direct seront intégrées progressivement avec des sources identifiées.', regionCompanies: 'Entreprises au catalogue', regionSectors: 'Secteurs représentés', disclaimer: 'Contenu informatif. Ne constitue pas un conseil en investissement.',
    'north-america': 'Amérique du Nord', 'south-america': 'Amérique du Sud', europe: 'Europe', africa: 'Afrique', 'middle-east': 'Moyen-Orient', 'asia-pacific': 'Asie-Pacifique',
    technology: 'Technologie', ai: 'Intelligence artificielle', energy: 'Énergie', materials: 'Mines et matériaux', agribusiness: 'Agro-industrie', mobility: 'Mobilité et automobile', health: 'Santé et biotechnologie', finance: 'Finance', industry: 'Industrie et automatisation', aerospace: 'Aérospatiale',
  },
  zh: {
    title: '全球商业雷达', subtitle: '企业与行业情报', overview: '总览', industries: '行业', companies: '企业', watchlist: '关注列表',
    globalMap: '全球企业地图', mapHint: '选择一个亮点以探索该地区', regions: '监测地区', companiesRef: '参考企业', sectorsTracked: '已收录行业',
    sectorFocus: '行业重点', explore: '探索行业', allRegions: '所有地区', search: '搜索企业或代码...', add: '添加', remove: '移除', saved: '已加入列表', empty: '关注列表为空。', emptyHint: '添加企业以便在此跟踪。',
    listed: '上市公司', private: '非上市公司', profile: '企业档案准备中', noResults: '未找到企业。', directory: '企业目录', watchHint: '您希望研究或跟踪的企业。',
    signals: '值得研究的主题', signalsHint: '行业研究方向，不构成买入信号或投资建议。', signal1: '人工智能基础设施', signal2: '能源转型与电网', signal3: '半导体与先进制造', signal4: '生物技术与精准医疗',
    dataNote: '初始参考目录。财务指标、新闻和实时趋势将分阶段接入，并明确标注来源。', regionCompanies: '目录中的企业', regionSectors: '涉及行业', disclaimer: '仅供参考，不构成投资建议。',
    'north-america': '北美', 'south-america': '南美', europe: '欧洲', africa: '非洲', 'middle-east': '中东', 'asia-pacific': '亚太',
    technology: '科技', ai: '人工智能', energy: '能源', materials: '采矿与材料', agribusiness: '农业综合企业', mobility: '交通与汽车', health: '医疗与生物技术', finance: '金融', industry: '工业与自动化', aerospace: '航空航天',
  },
  ja: {
    title: 'グローバル・レーダー', subtitle: '企業・産業インテリジェンス', overview: '概要', industries: '産業', companies: '企業', watchlist: 'ウォッチリスト',
    globalMap: 'グローバル企業マップ', mapHint: 'ポイントを選択して地域を探索', regions: '監視地域', companiesRef: '参考企業', sectorsTracked: '登録済みセクター',
    sectorFocus: 'セクター別注目分野', explore: 'セクターを探索', allRegions: 'すべての地域', search: '企業名またはティッカーを検索...', add: '追加', remove: '削除', saved: 'リストに追加済み', empty: 'ウォッチリストは空です。', emptyHint: '企業を追加してここで追跡できます。',
    listed: '上場企業', private: '非上場企業', profile: '企業プロフィール準備中', noResults: '企業が見つかりません。', directory: '企業ディレクトリ', watchHint: '調査または追跡したい企業。',
    signals: '調査テーマ', signalsHint: '業界調査テーマであり、売買シグナルや投資推奨ではありません。', signal1: 'AIインフラ', signal2: 'エネルギー転換と電力網', signal3: '半導体と先端製造', signal4: 'バイオテクノロジーと精密医療',
    dataNote: '初期参照カタログです。財務指標、ニュース、リアルタイム動向は出典を明記しながら段階的に統合します。', regionCompanies: '登録企業数', regionSectors: '対象セクター', disclaimer: '情報提供のみを目的とし、投資助言ではありません。',
    'north-america': '北米', 'south-america': '南米', europe: 'ヨーロッパ', africa: 'アフリカ', 'middle-east': '中東', 'asia-pacific': 'アジア太平洋',
    technology: 'テクノロジー', ai: '人工知能', energy: 'エネルギー', materials: '鉱業・素材', agribusiness: '農業ビジネス', mobility: 'モビリティ・自動車', health: '医療・バイオ', finance: '金融', industry: '産業・自動化', aerospace: '航空宇宙',
  },
  ko: {
    title: '글로벌 레이더', subtitle: '기업 및 산업 인텔리전스', overview: '개요', industries: '산업', companies: '기업', watchlist: '관심 목록',
    globalMap: '글로벌 기업 지도', mapHint: '점을 선택해 지역 탐색', regions: '모니터링 지역', companiesRef: '참고 기업', sectorsTracked: '등록 산업',
    sectorFocus: '산업별 집중 분야', explore: '산업 탐색', allRegions: '전체 지역', search: '기업 또는 티커 검색...', add: '추가', remove: '삭제', saved: '목록에 추가됨', empty: '관심 목록이 비어 있습니다.', emptyHint: '기업을 추가해 이곳에서 추적하세요.',
    listed: '상장 기업', private: '비상장 기업', profile: '기업 프로필 준비 중', noResults: '기업을 찾을 수 없습니다.', directory: '기업 디렉터리', watchHint: '조사하거나 추적하려는 기업.',
    signals: '조사할 주제', signalsHint: '산업 조사 주제이며 매수 신호나 투자 추천이 아닙니다.', signal1: '인공지능 인프라', signal2: '에너지 전환 및 전력망', signal3: '반도체 및 첨단 제조', signal4: '바이오 기술 및 정밀 의료',
    dataNote: '초기 참고 카탈로그입니다. 재무 지표, 뉴스 및 실시간 동향은 출처를 명시해 단계적으로 통합됩니다.', regionCompanies: '카탈로그 기업', regionSectors: '포함 산업', disclaimer: '정보 제공 목적이며 투자 조언이 아닙니다.',
    'north-america': '북미', 'south-america': '남미', europe: '유럽', africa: '아프리카', 'middle-east': '중동', 'asia-pacific': '아시아 태평양',
    technology: '기술', ai: '인공지능', energy: '에너지', materials: '광업 및 소재', agribusiness: '농업 비즈니스', mobility: '모빌리티 및 자동차', health: '의료 및 바이오', finance: '금융', industry: '산업 및 자동화', aerospace: '항공우주',
  },
  hi: {
    title: 'ग्लोबल रडार', subtitle: 'व्यवसाय और क्षेत्रीय इंटेलिजेंस', overview: 'अवलोकन', industries: 'उद्योग', companies: 'कंपनियाँ', watchlist: 'निगरानी सूची',
    globalMap: 'वैश्विक व्यवसाय मानचित्र', mapHint: 'किसी क्षेत्र को देखने के लिए बिंदु चुनें', regions: 'निगरानी वाले क्षेत्र', companiesRef: 'संदर्भ कंपनियाँ', sectorsTracked: 'सूचीबद्ध क्षेत्र',
    sectorFocus: 'क्षेत्र पर ध्यान', explore: 'क्षेत्र देखें', allRegions: 'सभी क्षेत्र', search: 'कंपनी या टिकर खोजें...', add: 'जोड़ें', remove: 'हटाएँ', saved: 'आपकी सूची में', empty: 'आपकी सूची खाली है।', emptyHint: 'यहाँ ट्रैक करने के लिए कंपनियाँ जोड़ें।',
    listed: 'सूचीबद्ध कंपनी', private: 'निजी कंपनी', profile: 'प्रोफ़ाइल तैयार की जा रही है', noResults: 'कोई कंपनी नहीं मिली।', directory: 'कंपनी निर्देशिका', watchHint: 'वे कंपनियाँ जिनका आप अध्ययन या अनुसरण करना चाहते हैं।',
    signals: 'जाँचने योग्य विषय', signalsHint: 'क्षेत्रीय शोध विषय; खरीद संकेत या निवेश सिफारिश नहीं।', signal1: 'कृत्रिम बुद्धिमत्ता का बुनियादी ढाँचा', signal2: 'ऊर्जा परिवर्तन और बिजली ग्रिड', signal3: 'सेमीकंडक्टर और उन्नत विनिर्माण', signal4: 'जैव प्रौद्योगिकी और सटीक स्वास्थ्य',
    dataNote: 'प्रारंभिक संदर्भ सूची। वित्तीय संकेतक, समाचार और लाइव रुझान स्रोतों की पहचान के साथ चरणों में जोड़े जाएँगे।', regionCompanies: 'सूची में कंपनियाँ', regionSectors: 'प्रतिनिधित्व वाले क्षेत्र', disclaimer: 'केवल जानकारी हेतु। निवेश सलाह नहीं।',
    'north-america': 'उत्तरी अमेरिका', 'south-america': 'दक्षिण अमेरिका', europe: 'यूरोप', africa: 'अफ्रीका', 'middle-east': 'मध्य पूर्व', 'asia-pacific': 'एशिया-प्रशांत',
    technology: 'प्रौद्योगिकी', ai: 'कृत्रिम बुद्धिमत्ता', energy: 'ऊर्जा', materials: 'खनन और सामग्री', agribusiness: 'कृषि व्यवसाय', mobility: 'गतिशीलता और ऑटोमोटिव', health: 'स्वास्थ्य और जैव प्रौद्योगिकी', finance: 'वित्त', industry: 'उद्योग और स्वचालन', aerospace: 'एयरोस्पेस',
  },
  ar: {
    title: 'الرادار العالمي', subtitle: 'ذكاء الأعمال والقطاعات', overview: 'نظرة عامة', industries: 'القطاعات', companies: 'الشركات', watchlist: 'قائمة المتابعة',
    globalMap: 'خريطة الأعمال العالمية', mapHint: 'اختر نقطة لاستكشاف منطقة', regions: 'المناطق قيد المتابعة', companiesRef: 'شركات مرجعية', sectorsTracked: 'القطاعات المدرجة',
    sectorFocus: 'تركيز القطاعات', explore: 'استكشاف القطاع', allRegions: 'كل المناطق', search: 'ابحث عن شركة أو رمز...', add: 'إضافة', remove: 'إزالة', saved: 'ضمن قائمتك', empty: 'قائمة المتابعة فارغة.', emptyHint: 'أضف شركات لمتابعتها هنا.',
    listed: 'شركة مدرجة', private: 'شركة خاصة', profile: 'الملف قيد الإعداد', noResults: 'لم يتم العثور على شركات.', directory: 'دليل الشركات', watchHint: 'الشركات التي تريد دراستها أو متابعتها.',
    signals: 'موضوعات تستحق البحث', signalsHint: 'محاور بحث قطاعية وليست إشارات شراء أو توصيات استثمارية.', signal1: 'البنية التحتية للذكاء الاصطناعي', signal2: 'تحول الطاقة وشبكات الكهرباء', signal3: 'أشباه الموصلات والتصنيع المتقدم', signal4: 'التكنولوجيا الحيوية والصحة الدقيقة',
    dataNote: 'دليل مرجعي أولي. ستتم إضافة المؤشرات المالية والأخبار والاتجاهات المباشرة تدريجياً مع تحديد المصادر.', regionCompanies: 'الشركات في الدليل', regionSectors: 'القطاعات الممثلة', disclaimer: 'محتوى معلوماتي، وليس نصيحة استثمارية.',
    'north-america': 'أمريكا الشمالية', 'south-america': 'أمريكا الجنوبية', europe: 'أوروبا', africa: 'أفريقيا', 'middle-east': 'الشرق الأوسط', 'asia-pacific': 'آسيا والمحيط الهادئ',
    technology: 'التكنولوجيا', ai: 'الذكاء الاصطناعي', energy: 'الطاقة', materials: 'التعدين والمواد', agribusiness: 'الأعمال الزراعية', mobility: 'التنقل والسيارات', health: 'الصحة والتكنولوجيا الحيوية', finance: 'التمويل', industry: 'الصناعة والأتمتة', aerospace: 'الفضاء والطيران',
  },
};

function makeT(locale: string) {
  const dict = copy[locale] ?? copy['pt-BR'];
  return (key: string) => dict[key] ?? copy['pt-BR'][key] ?? key;
}

const globePoints = [
  { x: 27, y: 35, id: 'north-america' as RegionId },
  { x: 38, y: 69, id: 'south-america' as RegionId },
  { x: 53, y: 31, id: 'europe' as RegionId },
  { x: 55, y: 60, id: 'africa' as RegionId },
  { x: 63, y: 48, id: 'middle-east' as RegionId },
  { x: 77, y: 40, id: 'asia-pacific' as RegionId },
];

export function RadarView() {
  const { locale } = useI18n();
  const t = makeT(locale);
  const [tab, setTab] = useState<'overview' | 'industries' | 'companies' | 'watchlist'>('overview');
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [sector, setSector] = useState<SectorId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  useEffect(() => {
    try { setWatchlist(JSON.parse(localStorage.getItem('nv-radar-watchlist') || '[]')); } catch { setWatchlist([]); }
  }, []);

  const toggleWatch = (name: string) => {
    setWatchlist(current => {
      const next = current.includes(name) ? current.filter(item => item !== name) : [...current, name];
      try { localStorage.setItem('nv-radar-watchlist', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const visibleCompanies = useMemo(() => companies.filter(company => {
    const matchesRegion = region === 'all' || company.region === region;
    const matchesSector = sector === 'all' || company.sector === sector;
    const matchesQuery = `${company.name} ${company.country} ${company.ticker}`.toLowerCase().includes(query.toLowerCase());
    const matchesTab = tab !== 'watchlist' || watchlist.includes(company.name);
    return matchesRegion && matchesSector && matchesQuery && matchesTab;
  }), [region, sector, query, tab, watchlist]);

  const selectedRegion = regions.find(item => item.id === region);
  const currentCompany = companies.find(item => item.name === selectedCompany);

  const tabs = [
    { id: 'overview' as const, label: t('overview'), icon: Globe },
    { id: 'industries' as const, label: t('industries'), icon: Factory },
    { id: 'companies' as const, label: t('companies'), icon: Building2 },
    { id: 'watchlist' as const, label: t('watchlist'), icon: Star },
  ];

  return (
    <section className="w-full min-w-0 space-y-5 pb-8" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <style>{'@keyframes radar-earth-rotation{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.radar-globe-spin{animation:radar-earth-rotation 72s linear infinite;transform-origin:50% 50%}@media(prefers-reduced-motion:reduce){.radar-globe-spin{animation:none}}'}</style>
      <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.20),transparent_45%),linear-gradient(145deg,rgba(13,16,30,0.98),rgba(8,10,20,0.98))] p-5 md:p-7 shadow-[0_20px_70px_rgba(76,29,149,0.12)]">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[10px] font-mono tracking-[0.2em] text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_#a78bfa] animate-pulse" /> NV PROTOCOL / INTELLIGENCE
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-[0.12em] text-white">{t('title')}</h1>
            <p className="mt-2 text-sm text-slate-300/75">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${tab === id ? 'border-violet-300/40 bg-violet-500/20 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.12)]' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-violet-300/25 hover:text-white'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)] gap-5">
          <div className="rounded-2xl border border-white/10 bg-card/70 p-4 md:p-5 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-foreground">{t('globalMap')}</h2><p className="mt-1 text-xs text-muted-foreground">{t('mapHint')}</p></div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-violet-300"><Activity size={12} /> GLOBAL</span>
            </div>
            <div className="relative mx-auto mt-5 aspect-square w-full max-w-[520px]">
              <div className="absolute inset-[4%] rounded-full bg-violet-500/10 blur-2xl" />
              <div className="absolute inset-[7%] rounded-full border border-violet-300/20 shadow-[0_0_55px_rgba(139,92,246,0.18),inset_0_0_45px_rgba(59,130,246,0.12)]" />
              <div className="absolute inset-[9%] overflow-hidden rounded-full border border-sky-300/20 bg-[radial-gradient(circle_at_34%_28%,rgba(59,130,246,0.35),rgba(15,23,42,0.95)_62%,rgba(4,8,20,1))]">
                <div className="radar-globe-spin absolute inset-0">
                  <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="Stylized rotating Earth with business regions">
                    <defs><clipPath id="radar-earth-clip"><circle cx="200" cy="200" r="195" /></clipPath><radialGradient id="radar-earth-shade" cx="35%" cy="30%"><stop offset="0%" stopColor="#38bdf8" stopOpacity=".20" /><stop offset="65%" stopColor="#1e40af" stopOpacity=".08" /><stop offset="100%" stopColor="#020617" stopOpacity=".75" /></radialGradient></defs>
                    <g clipPath="url(#radar-earth-clip)">
                      <g stroke="#93c5fd" strokeOpacity=".17" fill="none">
                        <circle cx="200" cy="200" r="190" /><ellipse cx="200" cy="200" rx="130" ry="195" /><ellipse cx="200" cy="200" rx="65" ry="195" /><ellipse cx="200" cy="200" rx="195" ry="65" /><ellipse cx="200" cy="200" rx="195" ry="130" /><path d="M0 200H400M0 100H400M0 300H400" />
                      </g>
                      <g fill="#38bdf8" fillOpacity=".30" stroke="#7dd3fc" strokeOpacity=".28" strokeWidth="1.2">
                        <path d="M42 93l20-21 25-5 18 11 26-2 18 18-8 17-23 4-8 18-23 4-10 24-20 4-7-19-19-8-8-24z" />
                        <path d="M118 177l19 8 12 25-7 29-14 23-8 35-14 24-12-18 3-31-12-26 8-29z" />
                        <path d="M185 83l19-13 21 5 13 16-9 13-21 1-13-9z" />
                        <path d="M204 124l24-15 33 5 18 18 25 7 20 22-12 18-22-3-11 18-24 3-11 29-18-9-10-25-20-13-7-27z" />
                        <path d="M214 211l28-7 22 15 6 29-15 38-22 30-19-10-12-35 4-34z" />
                        <path d="M294 260l21-8 24 13 8 18-21 12-25-9z" />
                        <path d="M330 105l20-8 16 14-9 19-21-2z" />
                      </g>
                      <circle cx="200" cy="200" r="195" fill="url(#radar-earth-shade)" />
                    </g>
                  </svg>
                  {globePoints.map(point => (
                    <button key={point.id} onClick={() => setRegion(point.id)} title={t(point.id)} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${region === point.id ? 'h-5 w-5 border-white bg-violet-300 shadow-[0_0_22px_8px_rgba(167,139,250,0.55)]' : 'h-3 w-3 border-violet-100/80 bg-violet-400 shadow-[0_0_14px_4px_rgba(139,92,246,0.55)] hover:scale-150'}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={t(point.id)} />
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.08)_48%,transparent_60%)]" />
              </div>
              <div className="absolute bottom-[1%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-violet-300/15 bg-background/70 px-3 py-1 text-[9px] font-mono tracking-widest text-violet-200/70">EARTH • BUSINESS NETWORK</div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {regions.map(item => <button key={item.id} onClick={() => setRegion(item.id)} className={`rounded-full border px-2.5 py-1 text-[10px] transition-colors ${region === item.id ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-muted-foreground hover:border-violet-300/30'}`}>{t(item.id)}</button>)}
              <button onClick={() => setRegion('all')} className={`rounded-full border px-2.5 py-1 text-[10px] ${region === 'all' ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-muted-foreground'}`}>{t('allRegions')}</button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-violet-300/15 bg-card/70 p-4">
              <div className="flex items-center gap-2 text-violet-300"><MapPin size={15} /><h2 className="text-sm font-semibold text-foreground">{t('regions')}</h2></div>
              <div className="mt-3 space-y-2">
                {regions.map(item => <button key={item.id} onClick={() => setRegion(item.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${region === item.id ? 'border-violet-300/30 bg-violet-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'}`}><span className="text-xs text-foreground">{t(item.id)}</span><ChevronRight size={13} className="text-violet-300/70" /></button>)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-card/70 p-4">
              <div className="flex items-center gap-2 text-violet-300"><Sparkles size={15} /><h2 className="text-sm font-semibold text-foreground">{t('signals')}</h2></div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{t('signalsHint')}</p>
              <div className="mt-3 space-y-2">{[1, 2, 3, 4].map(n => <div key={n} className="flex items-start gap-2 text-xs text-foreground/80"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,.7)]" />{t(`signal${n}`)}</div>)}</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'industries' && (
        <div className="rounded-2xl border border-white/10 bg-card/70 p-4 md:p-6">
          <div className="mb-4 flex items-center gap-2"><Factory size={17} className="text-violet-300" /><h2 className="text-sm font-semibold">{t('sectorFocus')}</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sectors.map((id, index) => <button key={id} onClick={() => { setSector(id); setTab('companies'); }} className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left hover:border-violet-300/35 hover:bg-violet-500/[0.06] transition-all"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"><Layers3 size={16} /></div><div><div className="text-sm font-medium text-foreground">{t(id)}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{companies.filter(c => c.sector === id).length} {t('companies').toLowerCase()}</div></div></div><ArrowUpRight size={15} className="text-violet-300/50 group-hover:text-violet-200" /></button>)}
          </div>
        </div>
      )}

      {(tab === 'companies' || tab === 'watchlist') && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-card/70 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div><h2 className="text-sm font-semibold">{tab === 'watchlist' ? t('watchlist') : t('directory')}</h2><p className="mt-1 text-xs text-muted-foreground">{tab === 'watchlist' ? t('watchHint') : t('companiesRef')}</p></div>
              <div className="relative w-full md:max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} className="w-full rounded-xl border border-white/10 bg-background/70 py-2.5 pl-9 pr-3 text-xs text-foreground outline-none focus:border-violet-300/40" /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setRegion('all')} className={`rounded-full border px-3 py-1.5 text-[10px] ${region === 'all' ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-muted-foreground'}`}>{t('allRegions')}</button>
              {regions.map(item => <button key={item.id} onClick={() => setRegion(item.id)} className={`rounded-full border px-3 py-1.5 text-[10px] ${region === item.id ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-muted-foreground'}`}>{t(item.id)}</button>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setSector('all')} className={`rounded-full border px-3 py-1.5 text-[10px] ${sector === 'all' ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-muted-foreground'}`}>{t('industries')}</button>
              {sectors.map(id => <button key={id} onClick={() => setSector(id)} className={`rounded-full border px-3 py-1.5 text-[10px] ${sector === id ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-muted-foreground'}`}>{t(id)}</button>)}
            </div>
          </div>
          {visibleCompanies.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-muted-foreground">{tab === 'watchlist' && watchlist.length === 0 ? <><Star className="mx-auto mb-3 text-violet-300" /><p>{t('empty')}</p><p className="mt-1 text-xs">{t('emptyHint')}</p></> : t('noResults')}</div> : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleCompanies.map(company => <article key={company.name} className="rounded-2xl border border-white/10 bg-card/70 p-4 transition-colors hover:border-violet-300/25">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Building2 size={18} /></div><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-foreground">{company.name}</h3><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{company.country} · {company.ticker}</p></div></div><button onClick={() => toggleWatch(company.name)} aria-label={watchlist.includes(company.name) ? t('remove') : t('add')} className="rounded-lg border border-white/10 p-2 text-violet-300 hover:bg-violet-500/10">{watchlist.includes(company.name) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button></div>
                <div className="mt-4 flex flex-wrap gap-1.5"><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] text-violet-200">{t(company.sector)}</span><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[9px] text-muted-foreground">{t('listed')}</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><span className="text-[10px] text-muted-foreground">{watchlist.includes(company.name) ? t('saved') : t('profile')}</span><button onClick={() => setSelectedCompany(company.name)} className="inline-flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-100">{t('companies')} <ChevronRight size={12} /></button></div>
              </article>)}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-card/50 p-3"><div className="text-[10px] text-muted-foreground">{t('regions')}</div><div className="mt-1 text-xl font-semibold text-violet-200">{regions.length}</div></div>
        <div className="rounded-xl border border-white/10 bg-card/50 p-3"><div className="text-[10px] text-muted-foreground">{t('companiesRef')}</div><div className="mt-1 text-xl font-semibold text-violet-200">{companies.length}</div></div>
        <div className="rounded-xl border border-white/10 bg-card/50 p-3"><div className="text-[10px] text-muted-foreground">{t('sectorsTracked')}</div><div className="mt-1 text-xl font-semibold text-violet-200">{sectors.length}</div></div>
      </div>

      {selectedRegion && <div className="rounded-xl border border-violet-300/20 bg-violet-500/[0.06] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-violet-100"><MapPin size={15} />{t(selectedRegion.id)}</div><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>{t('regionCompanies')}: {companies.filter(c => c.region === selectedRegion.id).length}</span><span>{t('regionSectors')}: {selectedRegion.sectors.length}</span></div><button onClick={() => setTab('companies')} className="mt-3 inline-flex items-center gap-1 text-xs text-violet-200">{t('companies')} <ChevronRight size={13} /></button></div>}

      {currentCompany && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSelectedCompany(null)}><div className="w-full max-w-md rounded-2xl border border-violet-300/25 bg-slate-950 p-5 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-start justify-between"><div><div className="text-[10px] font-mono tracking-widest text-violet-300">COMPANY PROFILE</div><h2 className="mt-2 text-xl font-semibold text-white">{currentCompany.name}</h2><p className="mt-1 text-xs text-slate-400">{currentCompany.country} · {currentCompany.ticker}</p></div><button onClick={() => setSelectedCompany(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={16} /></button></div><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="text-xs text-violet-200">{t(currentCompany.sector)}</div><p className="mt-2 text-xs leading-relaxed text-slate-400">{t('profile')}. {t('dataNote')}</p></div><button onClick={() => toggleWatch(currentCompany.name)} className="mt-4 w-full rounded-xl border border-violet-300/25 bg-violet-500/15 px-4 py-3 text-xs font-medium text-violet-100">{watchlist.includes(currentCompany.name) ? t('remove') : t('add')} {t('watchlist')}</button></div></div>}

      <div className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-3 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-300/80" /><div>{t('dataNote')}<div className="mt-1 text-muted-foreground/70">{t('disclaimer')}</div></div></div>
    </section>
  );
}
