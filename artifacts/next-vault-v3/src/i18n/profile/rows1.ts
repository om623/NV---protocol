// [key, pt-BR, en, es, fr, zh, ja, ko, hi, ar]
export type Row = [string, string, string, string, string, string, string, string, string, string];

export const ROWS_1: Row[] = [
  // Section navigation
  ['pf.nav.label', 'Seções do Perfil', 'Profile sections', 'Secciones del perfil', 'Sections du profil', '个人资料分区', 'プロフィールのセクション', '프로필 섹션', 'प्रोफ़ाइल अनुभाग', 'أقسام الملف الشخصي'],
  ['pf.nav.identity', 'Identidade', 'Identity', 'Identidad', 'Identité', '身份', 'アイデンティティ', '아이덴티티', 'पहचान', 'الهوية'],
  ['pf.nav.nvult', 'Nvult', 'Nvult', 'Nvult', 'Nvult', 'Nvult', 'Nvult', 'Nvult', 'Nvult', 'Nvult'],
  ['pf.nav.collection', 'Coleção', 'Collection', 'Colección', 'Collection', '收藏', 'コレクション', '컬렉션', 'संग्रह', 'المجموعة'],
  ['pf.nav.achievements', 'Conquistas', 'Achievements', 'Logros', 'Succès', '成就', '実績', '업적', 'उपलब्धियाँ', 'الإنجازات'],
  ['pf.nav.ranking', 'Ranking', 'Ranking', 'Clasificación', 'Classement', '排行榜', 'ランキング', '랭킹', 'रैंकिंग', 'الترتيب'],
  ['pf.nav.shop', 'Loja', 'Shop', 'Tienda', 'Boutique', '商店', 'ショップ', '상점', 'दुकान', 'المتجر'],
  // Honesty tags
  ['pf.tag.live', 'Real', 'Live', 'Real', 'Réel', '实时', 'ライブ', '실제', 'लाइव', 'مباشر'],
  ['pf.tag.local', 'Local', 'Local', 'Local', 'Local', '本地', 'ローカル', '로컬', 'स्थानीय', 'محلي'],
  ['pf.tag.soon', 'Em breve', 'Soon', 'Pronto', 'Bientôt', '即将推出', '近日公開', '준비 중', 'जल्द', 'قريبًا'],
  ['pf.tagHint.live', 'Dados reais do motor de XP ou pagamentos verificados no servidor.', 'Real data from the XP engine, or payments verified server-side.', 'Datos reales del motor de XP o pagos verificados en el servidor.', "Données réelles du moteur d'XP ou paiements vérifiés côté serveur.", '来自 XP 引擎的真实数据，或由服务器验证的支付。', 'XPエンジンの実データ、またはサーバーで検証された支払い。', 'XP 엔진의 실제 데이터 또는 서버에서 검증된 결제입니다.', 'XP इंजन का वास्तविक डेटा या सर्वर-सत्यापित भुगतान।', 'بيانات حقيقية من محرك الخبرة أو مدفوعات تم التحقق منها على الخادم.'],
  ['pf.tagHint.local', 'Salvo apenas neste dispositivo. Não é uma conta nem está na blockchain.', 'Saved on this device only. Not an account and not onchain.', 'Guardado solo en este dispositivo. No es una cuenta ni está en la cadena.', "Enregistré uniquement sur cet appareil. Ni compte ni onchain.", '仅保存在此设备上，不是账户，也不在链上。', 'この端末にのみ保存されます。アカウントでもオンチェーンでもありません。', '이 기기에만 저장됩니다. 계정이나 온체인이 아닙니다.', 'केवल इसी डिवाइस पर सहेजा गया। यह खाता या ऑनचेन नहीं है।', 'محفوظ على هذا الجهاز فقط. ليس حسابًا وليس على السلسلة.'],
  ['pf.tagHint.soon', 'Ainda não conectado. Nada aqui é simulado como real.', 'Not connected yet. Nothing here is simulated as real.', 'Aún no conectado. Nada aquí se simula como real.', "Pas encore connecté. Rien n'est simulé comme réel.", '尚未连接。此处没有任何内容被模拟为真实。', 'まだ接続されていません。実在するように模擬されたものはありません。', '아직 연결되지 않았습니다. 실제인 것처럼 꾸민 내용은 없습니다.', 'अभी जुड़ा नहीं है। यहाँ कुछ भी असली के रूप में नकली नहीं दिखाया गया।', 'لم يتم الربط بعد. لا شيء هنا يُحاكى على أنه حقيقي.'],
  // Evolution tiers
  ['pf.tier.0', 'Iniciado', 'Initiate', 'Iniciado', 'Initié', '入门者', '見習い', '입문자', 'प्रारंभिक', 'مبتدئ'],
  ['pf.tier.1', 'Operador', 'Operator', 'Operador', 'Opérateur', '操作员', 'オペレーター', '오퍼레이터', 'ऑपरेटर', 'مشغّل'],
  ['pf.tier.2', 'Adepto', 'Adept', 'Adepto', 'Adepte', '精通者', '熟練者', '숙련자', 'निपुण', 'بارع'],
  ['pf.tier.3', 'Vanguarda', 'Vanguard', 'Vanguardia', 'Avant-garde', '先锋', 'ヴァンガード', '뱅가드', 'अग्रणी', 'طليعي'],
  ['pf.tier.4', 'Sentinela', 'Sentinel', 'Centinela', 'Sentinelle', '哨兵', 'センチネル', '센티넬', 'प्रहरी', 'حارس'],
  ['pf.tier.5', 'Paragão', 'Paragon', 'Paragón', 'Parangon', '典范', 'パラゴン', '패러건', 'आदर्श', 'مثالي'],
  ['pf.tier.6', 'Ápice', 'Apex', 'Ápice', 'Apex', '巅峰', 'エイペックス', '에이펙스', 'शिखर', 'الذروة'],
  // Identity hub
  ['pf.hero.eyebrow', 'IDENTIDADE NV', 'NV IDENTITY', 'IDENTIDAD NV', 'IDENTITÉ NV', 'NV 身份', 'NV アイデンティティ', 'NV 아이덴티티', 'NV पहचान', 'هوية NV'],
  ['pf.hero.insignia', 'Emblema NV do perfil', 'NV profile insignia', 'Emblema NV del perfil', 'Insigne NV du profil', 'NV 个人徽章', 'NV プロフィールの紋章', 'NV 프로필 엠블럼', 'NV प्रोफ़ाइल प्रतीक', 'شارة ملف NV'],
  ['pf.hero.tier', 'Nível de evolução', 'Evolution tier', 'Fase de evolución', "Palier d'évolution", '进化阶段', '進化段階', '진화 단계', 'विकास चरण', 'مرحلة التطور'],
  ['pf.hero.customize', 'Personalizar o Nvult', 'Customize Nvult', 'Personalizar Nvult', 'Personnaliser Nvult', '自定义 Nvult', 'Nvult をカスタマイズ', 'Nvult 커스터마이즈', 'Nvult को अनुकूलित करें', 'تخصيص Nvult'],
  ['pf.hero.noWallet', 'Nenhuma carteira conectada', 'No wallet connected', 'Ninguna billetera conectada', 'Aucun portefeuille connecté', '未连接钱包', 'ウォレット未接続', '지갑 연결 안 됨', 'कोई वॉलेट कनेक्ट नहीं', 'لا توجد محفظة متصلة'],
  ['pf.hero.xpToGo', 'Faltam {n} XP', '{n} XP to go', 'Faltan {n} XP', 'Encore {n} XP', '还差 {n} XP', 'あと {n} XP', '{n} XP 남음', '{n} XP शेष', 'متبقٍ {n} XP'],
  ['pf.hero.seasonXp', 'XP da temporada', 'Season XP', 'XP de temporada', 'XP de saison', '赛季 XP', 'シーズンXP', '시즌 XP', 'सीज़न XP', 'XP الموسم'],
  ['pf.hero.season', 'Temporada {n}', 'Season {n}', 'Temporada {n}', 'Saison {n}', '第 {n} 赛季', 'シーズン {n}', '시즌 {n}', 'सीज़न {n}', 'الموسم {n}'],
  ['pf.hero.nextUnlocks', 'Próximos desbloqueios', 'Next unlocks', 'Próximos desbloqueos', 'Prochains déblocages', '下一批解锁', '次の解放', '다음 해금', 'अगले अनलॉक', 'عمليات الفتح التالية'],
  // Evolution history
  ['pf.ev.title', 'Histórico de evolução', 'Evolution history', 'Historial de evolución', "Historique d'évolution", '进化历程', '進化の履歴', '진화 기록', 'विकास इतिहास', 'سجل التطور'],
  ['pf.ev.reached', 'Alcançado', 'Reached', 'Alcanzado', 'Atteint', '已达成', '達成', '달성', 'प्राप्त', 'تم بلوغه'],
  ['pf.ev.next', 'Próximo', 'Next', 'Siguiente', 'Prochain', '下一个', '次', '다음', 'अगला', 'التالي'],
  ['pf.ev.upcoming', 'Futuro', 'Upcoming', 'Futuro', 'À venir', '未来', '今後', '예정', 'आगामी', 'قادم'],
  ['pf.ev.allReached', 'Todos os marcos atuais foram alcançados.', 'All current milestones reached.', 'Todos los hitos actuales alcanzados.', 'Tous les jalons actuels sont atteints.', '已达成当前所有里程碑。', '現在のマイルストーンをすべて達成しました。', '현재 모든 마일스톤을 달성했습니다.', 'सभी वर्तमान पड़ाव पूरे हो गए।', 'تم بلوغ جميع المعالم الحالية.'],
  ['pf.ev.dateNote', 'As datas não são registradas pelo motor atual; o histórico mostra marcos de nível, não horários.', 'Dates are not recorded by the current engine; the history shows level milestones, not timestamps.', 'El motor actual no registra fechas; el historial muestra hitos de nivel, no horas.', "Le moteur actuel n'enregistre pas les dates ; l'historique montre des jalons de niveau, pas des horodatages.", '当前引擎不记录日期；历史仅显示等级里程碑，而非时间戳。', '現在のエンジンは日付を記録しません。履歴にはレベルの節目のみが表示され、時刻は含まれません。', '현재 엔진은 날짜를 기록하지 않습니다. 기록에는 시각이 아니라 레벨 마일스톤만 표시됩니다.', 'वर्तमान इंजन तिथियाँ दर्ज नहीं करता; इतिहास में लेवल पड़ाव दिखते हैं, समय नहीं।', 'لا يسجّل المحرك الحالي التواريخ؛ يعرض السجل معالم المستوى لا الطوابع الزمنية.'],
  ['pf.ev.purchases', 'Compras verificadas', 'Verified purchases', 'Compras verificadas', 'Achats vérifiés', '已验证的购买', '検証済みの購入', '검증된 구매', 'सत्यापित खरीदारी', 'مشتريات تم التحقق منها'],
  ['pf.ev.noPurchases', 'Nenhuma compra verificada ainda.', 'No verified purchases yet.', 'Aún no hay compras verificadas.', "Aucun achat vérifié pour l'instant.", '暂无已验证的购买。', '検証済みの購入はまだありません。', '아직 검증된 구매가 없습니다.', 'अभी कोई सत्यापित खरीदारी नहीं।', 'لا توجد مشتريات موثّقة بعد.'],
  // Achievements
  ['pf.ach.title', '{n} de {total} conquistas', '{n} of {total} achievements', '{n} de {total} logros', '{n} succès sur {total}', '已获得 {n} / {total} 项成就', '実績 {n} / {total}', '업적 {n} / {total}', '{total} में से {n} उपलब्धियाँ', '{n} من {total} إنجازات'],
  ['pf.ach.unlocked', 'Desbloqueada', 'Unlocked', 'Desbloqueado', 'Débloqué', '已解锁', '解放済み', '해금됨', 'अनलॉक', 'مفتوح'],
  ['pf.ach.progress', '{n}% para o nível {l}', '{n}% to level {l}', '{n}% hacia el nivel {l}', '{n} % vers le niveau {l}', '距等级 {l} 已完成 {n}%', 'レベル {l} まで {n}%', '레벨 {l}까지 {n}%', 'स्तर {l} तक {n}%', '{n}% نحو المستوى {l}'],
];
