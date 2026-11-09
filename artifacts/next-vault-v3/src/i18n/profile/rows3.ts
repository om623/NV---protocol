import type { Row } from './rows1';

export const ROWS_3: Row[] = [
  // Head
  ['pf.part.head.standard', 'Padrão', 'Standard', 'Estándar', 'Standard', '标准', 'スタンダード', '기본', 'मानक', 'قياسي'],
  ['pf.part.head.crest', 'Crista', 'Crest', 'Cresta', 'Crête', '冠羽', 'クレスト', '크레스트', 'शिखा', 'تاج'],
  ['pf.part.head.dome', 'Domo', 'Dome', 'Cúpula', 'Dôme', '穹顶', 'ドーム', '돔', 'गुंबद', 'قبة'],
  ['pf.part.head.spectra', 'Visor Spectra', 'Spectra visor', 'Visor Spectra', 'Visière Spectra', 'Spectra 面甲', 'スペクトラ・バイザー', '스펙트라 바이저', 'स्पेक्ट्रा वाइज़र', 'حاجب سبكترا'],
  ['pf.part.head.halo', 'Auréola', 'Halo', 'Halo', 'Halo', '光环冠', 'ヘイロー', '헤일로', 'प्रभामंडल', 'هالة'],
  ['pf.part.head.aegis', 'Égide', 'Aegis', 'Égida', 'Égide', '神盾冠', 'イージス', '이지스', 'ईजिस', 'إيجيس'],
  // Armor
  ['pf.part.armor.core', 'Núcleo', 'Core', 'Núcleo', 'Noyau', '核心', 'コア', '코어', 'कोर', 'النواة'],
  ['pf.part.armor.plated', 'Placas', 'Plated', 'Placas', 'Plaqué', '板甲', 'プレート', '플레이트', 'प्लेटेड', 'مصفّح'],
  ['pf.part.armor.pulse', 'Pulso', 'Pulse', 'Pulso', 'Pulsation', '脉冲', 'パルス', '펄스', 'पल्स', 'نبض'],
  ['pf.part.armor.bulwark', 'Baluarte', 'Bulwark', 'Baluarte', 'Rempart', '堡垒', 'ブルワーク', '불워크', 'बुलवर्क', 'حصن'],
  ['pf.part.armor.vanguard', 'Vanguarda', 'Vanguard', 'Vanguardia', 'Avant-garde', '先锋', 'ヴァンガード', '뱅가드', 'वैनगार्ड', 'الطليعة'],
  // Back
  ['pf.part.back.none', 'Nenhum', 'None', 'Ninguno', 'Aucun', '无', 'なし', '없음', 'कोई नहीं', 'بلا'],
  ['pf.part.back.antenna', 'Antenas', 'Antennas', 'Antenas', 'Antennes', '天线阵', 'アンテナ', '안테나', 'एंटीना', 'هوائيات'],
  ['pf.part.back.crawler', 'Patas aracnídeas', 'Crawler legs', 'Patas arácnidas', "Pattes d'araignée", '蜘蛛腿', 'クローラーレッグ', '크롤러 다리', 'क्रॉलर पैर', 'أرجل العنكبوت'],
  ['pf.part.back.wings', 'Asas de energia', 'Energy wings', 'Alas de energía', "Ailes d'énergie", '能量之翼', 'エナジーウィング', '에너지 날개', 'ऊर्जा पंख', 'أجنحة الطاقة'],
  // Weapon
  ['pf.part.weapon.none', 'Nenhuma', 'None', 'Ninguna', 'Aucune', '无', 'なし', '없음', 'कोई नहीं', 'بلا'],
  ['pf.part.weapon.blade', 'Lâmina de plasma', 'Plasma blade', 'Hoja de plasma', 'Lame plasma', '等离子刃', 'プラズマブレード', '플라즈마 블레이드', 'प्लाज़्मा ब्लेड', 'نصل البلازما'],
  ['pf.part.weapon.staff', 'Cajado de arco', 'Arc staff', 'Bastón de arco', 'Bâton à arc', '电弧法杖', 'アークスタッフ', '아크 스태프', 'आर्क स्टाफ', 'عصا القوس'],
  ['pf.part.weapon.lance', 'Lança de dados', 'Data lance', 'Lanza de datos', 'Lance de données', '数据长枪', 'データランス', '데이터 랜스', 'डेटा लांस', 'رمح البيانات'],
  // Aura
  ['pf.part.aura.none', 'Nenhuma', 'None', 'Ninguna', 'Aucune', '无', 'なし', '없음', 'कोई नहीं', 'بلا'],
  ['pf.part.aura.ring', 'Anel orbital', 'Orbit ring', 'Anillo orbital', 'Anneau orbital', '轨道环', 'オービットリング', '궤도 링', 'कक्षीय वलय', 'حلقة مدارية'],
  ['pf.part.aura.embers', 'Brasas', 'Embers', 'Brasas', 'Braises', '余烬', 'エンバー', '불씨', 'अंगारे', 'جمرات'],
  ['pf.part.aura.nebula', 'Nebulosa', 'Nebula', 'Nebulosa', 'Nébuleuse', '星云', 'ネビュラ', '성운', 'निहारिका', 'سديم'],
  // Honest notes, ranking, shop
  ['pf.note.localOnly', 'O visual do Nvult é salvo apenas neste dispositivo.', "Your Nvult's look is saved on this device only.", 'El aspecto de tu Nvult se guarda solo en este dispositivo.', "L'apparence de votre Nvult est enregistrée uniquement sur cet appareil.", '你的 Nvult 外观仅保存在此设备上。', 'Nvult の外観はこの端末にのみ保存されます。', 'Nvult의 외형은 이 기기에만 저장됩니다.', 'आपके Nvult का रूप केवल इसी डिवाइस पर सहेजा जाता है।', 'يُحفظ مظهر Nvult على هذا الجهاز فقط.'],
  ['pf.note.noCurrency', 'O Nvult não tem moeda nem token: os itens são liberados com XP e nível reais.', 'Nvult has no coin or token: items unlock with your real XP and level.', 'Nvult no tiene moneda ni token: los elementos se desbloquean con tu XP y nivel reales.', "Nvult n'a ni pièce ni jeton : les objets se débloquent avec votre XP et niveau réels.", 'Nvult 没有代币或货币：物品随你真实的 XP 和等级解锁。', 'Nvult にコインやトークンはありません。アイテムは実際のXPとレベルで解放されます。', 'Nvult에는 코인이나 토큰이 없습니다. 아이템은 실제 XP와 레벨로 해금됩니다.', 'Nvult में कोई सिक्का या टोकन नहीं है: आइटम आपके वास्तविक XP और स्तर से अनलॉक होते हैं।', 'لا عملة ولا رمز في Nvult: تُفتح العناصر بخبرتك ومستواك الحقيقيين.'],
  ['pf.rank.globalOff', 'O ranking global ainda não está conectado. Aqui aparecem apenas os seus dados reais.', 'The global ranking is not connected yet. Only your own real data appears here.', 'La clasificación global aún no está conectada. Aquí solo aparecen tus datos reales.', "Le classement mondial n'est pas encore connecté. Seules vos données réelles apparaissent ici.", '全球排行榜尚未接入，这里只显示你自己的真实数据。', 'グローバルランキングはまだ接続されていません。ここにはあなた自身の実データのみ表示されます。', '글로벌 랭킹은 아직 연결되지 않았습니다. 여기에는 내 실제 데이터만 표시됩니다.', 'वैश्विक रैंकिंग अभी जुड़ी नहीं है। यहाँ केवल आपका वास्तविक डेटा दिखता है।', 'الترتيب العالمي غير متصل بعد. تظهر هنا بياناتك الحقيقية فقط.'],
  ['pf.rank.seasonShare', '{n}% do seu XP total veio nesta temporada.', '{n}% of your total XP was earned this season.', 'El {n}% de tu XP total se ganó en esta temporada.', '{n} % de votre XP total a été gagné cette saison.', '你总 XP 的 {n}% 来自本赛季。', '総XPの {n}% が今シーズンに獲得したものです。', '전체 XP의 {n}%를 이번 시즌에 얻었습니다.', 'आपके कुल XP का {n}% इस सीज़न में अर्जित हुआ।', '{n}% من إجمالي خبرتك اكتُسب في هذا الموسم.'],
  ['pf.shop.live', 'Pagamentos reais, verificados no servidor e na blockchain. Nada aqui é simulado.', 'Real payments, verified server-side and onchain. Nothing here is simulated.', 'Pagos reales, verificados en el servidor y onchain. Nada aquí es simulado.', "Paiements réels, vérifiés côté serveur et onchain. Rien n'est simulé ici.", '真实支付，经服务器和链上验证，此处没有任何模拟。', '実際の支払いで、サーバーとオンチェーンで検証されます。模擬はありません。', '실제 결제이며 서버와 온체인에서 검증됩니다. 모의 항목은 없습니다.', 'वास्तविक भुगतान, सर्वर और ऑनचेन पर सत्यापित। यहाँ कुछ भी नकली नहीं।', 'مدفوعات حقيقية يتم التحقق منها على الخادم وعلى السلسلة. لا شيء هنا مُحاكى.'],
  // Rarity (derived from the level that unlocks an item) and personalization feedback
  ['pf.rarity.common', 'Comum', 'Common', 'Común', 'Commun', '普通', 'コモン', '일반', 'सामान्य', 'شائع'],
  ['pf.rarity.rare', 'Raro', 'Rare', 'Raro', 'Rare', '稀有', 'レア', '희귀', 'दुर्लभ', 'نادر'],
  ['pf.rarity.epic', 'Épico', 'Epic', 'Épico', 'Épique', '史诗', 'エピック', '에픽', 'महाकाव्य', 'ملحمي'],
  ['pf.rarity.legendary', 'Lendário', 'Legendary', 'Legendario', 'Légendaire', '传说', 'レジェンダリー', '전설', 'पौराणिक', 'أسطوري'],
  ['pf.rarity.mythic', 'Mítico', 'Mythic', 'Mítico', 'Mythique', '神话', 'ミシック', '신화', 'दिव्य', 'خرافي'],
  ['pf.lab.announceEquipped', '{name} equipado', '{name} equipped', '{name} equipado', '{name} équipé', '已装备 {name}', '{name} を装備しました', '{name} 장착됨', '{name} लगाया गया', 'تم تجهيز {name}'],
  ['pf.lab.announceCleared', '{name} removido', '{name} removed', '{name} quitado', '{name} retiré', '已移除 {name}', '{name} を外しました', '{name} 해제됨', '{name} हटाया गया', 'تمت إزالة {name}'],
  ['pf.lab.announceReset', 'Visual restaurado', 'Look reset', 'Aspecto restablecido', 'Apparence réinitialisée', '外观已重置', '外観をリセットしました', '외형이 초기화되었습니다', 'रूप रीसेट हुआ', 'تمت إعادة ضبط المظهر'],
  ['pf.lab.announceRandom', 'Novo visual gerado', 'New look generated', 'Nuevo aspecto generado', 'Nouvelle apparence générée', '已生成新外观', '新しい外観を生成しました', '새 외형이 생성되었습니다', 'नया रूप बनाया गया', 'تم إنشاء مظهر جديد'],
  ['pf.lab.announceAccent', 'Cor: {name}', 'Accent: {name}', 'Acento: {name}', 'Accent : {name}', '强调色：{name}', 'アクセント：{name}', '강조색: {name}', 'रंग: {name}', 'اللون: {name}'],
  ['pf.lab.announceStyle', 'Estilo: {name}', 'Style: {name}', 'Estilo: {name}', 'Style : {name}', '体型：{name}', 'スタイル：{name}', '스타일: {name}', 'शैली: {name}', 'الشكل: {name}'],
  ["pf.v3.hint", "Arraste ou use as setas do teclado para girar o Nvult. Início ou Esc volta à frente.", "Drag, or use the arrow keys, to rotate the Nvult. Home or Escape returns to the front.", "Arrastra o usa las flechas del teclado para girar al Nvult. Inicio o Esc vuelve al frente.", "Faites glisser ou utilisez les flèches du clavier pour faire tourner le Nvult. Début ou Échap revient de face.", "拖动或使用键盘方向键旋转 Nvult。按 Home 或 Esc 回到正面。", "ドラッグまたは矢印キーで Nvult を回転できます。Home または Esc で正面に戻ります。", "드래그하거나 방향키로 Nvult를 회전하세요. Home 또는 Esc로 정면으로 돌아갑니다.", "Nvult को घुमाने के लिए खींचें या तीर कुंजियाँ इस्तेमाल करें। Home या Esc सामने लौटाता है।", "اسحب أو استخدم مفاتيح الأسهم لتدوير Nvult. يعيدك Home أو Escape إلى الواجهة."],
  ["pf.v3.left", "Girar para a esquerda", "Rotate left", "Girar a la izquierda", "Tourner à gauche", "向左旋转", "左に回転", "왼쪽으로 회전", "बाएँ घुमाएँ", "تدوير لليسار"],
  ["pf.v3.right", "Girar para a direita", "Rotate right", "Girar a la derecha", "Tourner à droite", "向右旋转", "右に回転", "오른쪽으로 회전", "दाएँ घुमाएँ", "تدوير لليمين"],
  ["pf.v3.reset", "Voltar à frente", "Face front", "Volver al frente", "Remettre de face", "回到正面", "正面に戻す", "정면으로", "सामने लाएँ", "العودة للواجهة"],
  ["pf.v3.fallback", "Visão simples (3D indisponível)", "Simple view (3D unavailable)", "Vista simple (3D no disponible)", "Vue simple (3D indisponible)", "简易视图（3D 不可用）", "シンプル表示（3D は利用できません）", "간단 보기 (3D 사용 불가)", "सरल दृश्य (3D उपलब्ध नहीं)", "عرض مبسّط (3D غير متاح)"],
];
