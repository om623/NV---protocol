import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, BookOpen, ChevronRight, Clock3, Copy, Download, ExternalLink, FileText, Mail, Palette, Settings2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { clearNVActivity, logNVActivity, readNVActivity, type NVActivity } from '../lib/activityLog';
import { useI18n } from '../i18n';

const panel = 'rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm';
const titleClass = 'text-lg font-semibold text-foreground';
const subtle = 'text-sm text-muted-foreground';

type ModuleCopyKey =
  | 'history' | 'historyDesc' | 'hashesRegistered' | 'hashesFound' | 'noHash'
  | 'hashEmpty' | 'copyHash' | 'recentActivity' | 'localActivity'
  | 'noActivity' | 'reports' | 'reportsDesc' | 'actionsRecorded' | 'txHashes'
  | 'agentNews' | 'globalMarkets' | 'activityRegister' | 'activityRegisterDesc'
  | 'exportJson' | 'clear' | 'filterRecords' | 'allCategories' | 'wallet'
  | 'swap' | 'bridge' | 'agent' | 'news' | 'navigation' | 'system' | 'noFilter'
  | 'privacy' | 'settings' | 'settingsDesc' | 'interfacePrefs' | 'compact'
  | 'compactDesc' | 'reduceMotion' | 'reduceMotionDesc' | 'securityReminders'
  | 'securityRemindersDesc' | 'modeGoat' | 'modeGoatDesc' | 'secureConfig'
  | 'secureConfigDesc' | 'help' | 'helpDesc' | 'tutorial' | 'dashboardStep'
  | 'dashboardBody' | 'walletStep' | 'walletBody' | 'swapBridgeStep' | 'swapBridgeBody'
  | 'agentStep' | 'agentBody' | 'historyStep' | 'historyBody' | 'contact' | 'contactDesc'
  | 'securityWarning' | 'soon';
const MODULE_COPY: Record<string, Record<ModuleCopyKey, string>> = {
  'pt-BR': {
    history:'Histórico', historyDesc:'Hashes de transações e ações registradas neste navegador.', hashesRegistered:'Hashes registrados', hashesFound:'hash(es) encontrados', noHash:'Nenhum hash registrado ainda. Após uma transação confirmada, o NV Protocol poderá exibi-lo aqui neste dispositivo.', hashEmpty:'Ainda não há atividades registradas.', copyHash:'Copiar hash', recentActivity:'Atividade recente', localActivity:'Registros locais do uso do NV Protocol.', noActivity:'Ainda não há atividades registradas.',
    reports:'Relatórios', reportsDesc:'Registro local de ações do app, com exportação para auditoria pessoal.', actionsRecorded:'Ações registradas', txHashes:'Hashes de transação', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'Registro de atividade', activityRegisterDesc:'Inclui navegação, carteira, swaps/bridges confirmados, agente e mercados conforme os eventos integrados.', exportJson:'Exportar JSON', clear:'Limpar', filterRecords:'Filtrar registros', allCategories:'Todas as categorias', wallet:'Carteira', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'Navegação', system:'Sistema', noFilter:'Não há registros para este filtro.', privacy:'Privacidade: os registros ficam no armazenamento local deste navegador/dispositivo; não são enviados automaticamente para um servidor e não sincronizam entre dispositivos.',
    settings:'Configurações', settingsDesc:'Personalize alguns detalhes da sua experiência. As preferências ficam neste navegador.', interfacePrefs:'Preferências de interface', compact:'Interface compacta', compactDesc:'Reduz alguns espaços para mostrar mais conteúdo na tela.', reduceMotion:'Reduzir animações', reduceMotionDesc:'Diminui movimentos e transições da interface.', securityReminders:'Mostrar lembretes de segurança', securityRemindersDesc:'Exibe um lembrete de segurança nesta página de configurações.', modeGoat:'Mode Goat', modeGoatDesc:'Um modo especial está sendo preparado.', secureConfig:'Configuração segura', secureConfigDesc:'Estas opções alteram somente a experiência visual. Não mudam redes, permissões ou regras de transações.',
    help:'Ajuda', helpDesc:'Um guia rápido para começar a usar o NV Protocol.', tutorial:'Mini-tutorial', dashboardStep:'1. Conheça o Dashboard', dashboardBody:'Acompanhe os indicadores de mercado, ativos, TVL e informações disponíveis no momento.', walletStep:'2. Conecte sua carteira', walletBody:'Abra Carteira e conecte uma carteira compatível. Confira sempre a rede, o endereço e os dados exibidos.', swapBridgeStep:'3. Use Swap e Bridge com atenção', swapBridgeBody:'Revise ativo, valor e rede de destino. Toda transação real deve ser conferida e aprovada na sua carteira. O suporte depende das redes e dos ativos disponíveis.', agentStep:'4. Consulte NV Agent e NV News', agentBody:'Use o NV Agent para explorar as informações carregadas e abra as fontes originais do NV News para verificar o contexto.', historyStep:'5. Consulte Histórico e Relatórios', historyBody:'Veja os hashes e eventos que este navegador conseguiu registrar. A atividade local pode não incluir operações feitas fora do app ou antes deste recurso.', contact:'Fale conosco', contactDesc:'Dúvidas, problemas ou sugestões.', securityWarning:'Segurança: nunca compartilhe sua frase-semente ou chave privada. Confira a rede, os endereços e os detalhes antes de aprovar qualquer transação.', soon:'EM BREVE'
  },
  en: {
    history:'History', historyDesc:'Transaction hashes and actions recorded in this browser.', hashesRegistered:'Recorded hashes', hashesFound:'hash(es) found', noHash:'No hashes recorded yet. After a confirmed transaction, NV Protocol may display it here on this device.', hashEmpty:'No activity has been recorded yet.', copyHash:'Copy hash', recentActivity:'Recent activity', localActivity:'Local records of NV Protocol usage.', noActivity:'No activity recorded yet.',
    reports:'Reports', reportsDesc:'Local app activity log, exportable for personal auditing.', actionsRecorded:'Recorded actions', txHashes:'Transaction hashes', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'Activity log', activityRegisterDesc:'Includes navigation, wallet, confirmed swaps/bridges, agent and markets according to integrated events.', exportJson:'Export JSON', clear:'Clear', filterRecords:'Filter records', allCategories:'All categories', wallet:'Wallet', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'Navigation', system:'System', noFilter:'No records match this filter.', privacy:'Privacy: records stay in this browser/device storage; they are not automatically sent to a server and do not sync across devices.',
    settings:'Settings', settingsDesc:'Customize a few details of your experience. Preferences stay in this browser.', interfacePrefs:'Interface preferences', compact:'Compact interface', compactDesc:'Reduces spacing to show more content on screen.', reduceMotion:'Reduce animations', reduceMotionDesc:'Reduces interface motion and transitions.', securityReminders:'Show security reminders', securityRemindersDesc:'Displays a security reminder on this settings page.', modeGoat:'Mode Goat', modeGoatDesc:'A special mode is being prepared.', secureConfig:'Secure configuration', secureConfigDesc:'These options only change the visual experience. They do not change networks, permissions, or transaction rules.',
    help:'Help', helpDesc:'A quick guide to getting started with NV Protocol.', tutorial:'Quick tutorial', dashboardStep:'1. Explore the Dashboard', dashboardBody:'Follow market indicators, assets, TVL, and currently available information.', walletStep:'2. Connect your wallet', walletBody:'Open Wallet and connect a compatible wallet. Always check the network, address, and displayed details.', swapBridgeStep:'3. Use Swap and Bridge carefully', swapBridgeBody:'Review the asset, amount, and destination network. Every real transaction must be checked and approved in your wallet. Support depends on available networks and assets.', agentStep:'4. Explore NV Agent and NV News', agentBody:'Use NV Agent to explore loaded information and open original NV News sources to verify context.', historyStep:'5. Check History and Reports', historyBody:'Review hashes and events recorded by this browser. Local activity may not include operations performed outside the app or before this feature existed.', contact:'Contact us', contactDesc:'Questions, issues, or suggestions.', securityWarning:'Security: never share your seed phrase or private key. Check the network, addresses, and details before approving any transaction.', soon:'COMING SOON'
  },
  es: {
    history:'Historial', historyDesc:'Hashes de transacciones y acciones registradas en este navegador.', hashesRegistered:'Hashes registrados', hashesFound:'hash(es) encontrados', noHash:'Aún no hay hashes registrados. Tras una transacción confirmada, NV Protocol podrá mostrarla aquí en este dispositivo.', hashEmpty:'Todavía no hay actividad registrada.', copyHash:'Copiar hash', recentActivity:'Actividad reciente', localActivity:'Registros locales del uso de NV Protocol.', noActivity:'Todavía no hay actividades registradas.',
    reports:'Informes', reportsDesc:'Registro local de actividad de la app, exportable para auditoría personal.', actionsRecorded:'Acciones registradas', txHashes:'Hashes de transacción', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'Registro de actividad', activityRegisterDesc:'Incluye navegación, cartera, swaps/bridges confirmados, agente y mercados según los eventos integrados.', exportJson:'Exportar JSON', clear:'Borrar', filterRecords:'Filtrar registros', allCategories:'Todas las categorías', wallet:'Cartera', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'Navegación', system:'Sistema', noFilter:'No hay registros para este filtro.', privacy:'Privacidad: los registros permanecen en el almacenamiento local de este navegador/dispositivo; no se envían automáticamente a un servidor ni se sincronizan entre dispositivos.',
    settings:'Configuración', settingsDesc:'Personaliza algunos detalles de tu experiencia. Las preferencias se guardan en este navegador.', interfacePrefs:'Preferencias de interfaz', compact:'Interfaz compacta', compactDesc:'Reduce los espacios para mostrar más contenido en pantalla.', reduceMotion:'Reducir animaciones', reduceMotionDesc:'Reduce los movimientos y transiciones de la interfaz.', securityReminders:'Mostrar recordatorios de seguridad', securityRemindersDesc:'Muestra un recordatorio de seguridad en esta página.', modeGoat:'Mode Goat', modeGoatDesc:'Se está preparando un modo especial.', secureConfig:'Configuración segura', secureConfigDesc:'Estas opciones solo cambian la experiencia visual. No modifican redes, permisos ni reglas de transacción.',
    help:'Ayuda', helpDesc:'Una guía rápida para comenzar a usar NV Protocol.', tutorial:'Mini tutorial', dashboardStep:'1. Conoce el Dashboard', dashboardBody:'Consulta indicadores de mercado, activos, TVL e información disponible.', walletStep:'2. Conecta tu cartera', walletBody:'Abre Cartera y conecta una compatible. Comprueba siempre la red, la dirección y los datos mostrados.', swapBridgeStep:'3. Usa Swap y Bridge con cuidado', swapBridgeBody:'Revisa el activo, el importe y la red de destino. Toda transacción real debe revisarse y aprobarse en tu cartera. La compatibilidad depende de las redes y activos disponibles.', agentStep:'4. Consulta NV Agent y NV News', agentBody:'Usa NV Agent para explorar la información cargada y abre las fuentes originales de NV News para comprobar el contexto.', historyStep:'5. Consulta Historial e Informes', historyBody:'Consulta los hashes y eventos registrados por este navegador. La actividad local puede no incluir operaciones externas a la app o anteriores a esta función.', contact:'Contáctanos', contactDesc:'Dudas, problemas o sugerencias.', securityWarning:'Seguridad: nunca compartas tu frase semilla ni tu clave privada. Comprueba la red, las direcciones y los detalles antes de aprobar una transacción.', soon:'PRÓXIMAMENTE'
  },
  fr: {
    history:'Historique', historyDesc:'Hashes de transactions et actions enregistrés dans ce navigateur.', hashesRegistered:'Hashes enregistrés', hashesFound:'hash(es) trouvé(s)', noHash:'Aucun hash enregistré pour le moment. Après une transaction confirmée, NV Protocol pourra l’afficher ici sur cet appareil.', hashEmpty:'Aucune activité enregistrée pour le moment.', copyHash:'Copier le hash', recentActivity:'Activité récente', localActivity:'Enregistrements locaux de l’utilisation de NV Protocol.', noActivity:'Aucune activité enregistrée pour le moment.',
    reports:'Rapports', reportsDesc:'Journal local des actions de l’application, exportable pour un audit personnel.', actionsRecorded:'Actions enregistrées', txHashes:'Hashes de transaction', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'Journal d’activité', activityRegisterDesc:'Inclut la navigation, le portefeuille, les swaps/bridges confirmés, l’agent et les marchés selon les événements intégrés.', exportJson:'Exporter JSON', clear:'Effacer', filterRecords:'Filtrer les entrées', allCategories:'Toutes les catégories', wallet:'Portefeuille', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'Navigation', system:'Système', noFilter:'Aucune entrée pour ce filtre.', privacy:'Confidentialité : les enregistrements restent dans le stockage local de ce navigateur/appareil ; ils ne sont pas envoyés automatiquement à un serveur et ne sont pas synchronisés entre appareils.',
    settings:'Paramètres', settingsDesc:'Personnalisez quelques détails de votre expérience. Les préférences restent dans ce navigateur.', interfacePrefs:'Préférences d’interface', compact:'Interface compacte', compactDesc:'Réduit les espaces pour afficher davantage de contenu.', reduceMotion:'Réduire les animations', reduceMotionDesc:'Réduit les mouvements et transitions de l’interface.', securityReminders:'Afficher les rappels de sécurité', securityRemindersDesc:'Affiche un rappel de sécurité sur cette page.', modeGoat:'Mode Goat', modeGoatDesc:'Un mode spécial est en préparation.', secureConfig:'Configuration sécurisée', secureConfigDesc:'Ces options modifient uniquement l’apparence. Elles ne changent ni les réseaux, ni les autorisations, ni les règles de transaction.',
    help:'Aide', helpDesc:'Un guide rapide pour commencer à utiliser NV Protocol.', tutorial:'Mini-tutoriel', dashboardStep:'1. Découvrir le Dashboard', dashboardBody:'Suivez les indicateurs de marché, les actifs, la TVL et les informations disponibles.', walletStep:'2. Connecter votre portefeuille', walletBody:'Ouvrez Portefeuille et connectez un portefeuille compatible. Vérifiez toujours le réseau, l’adresse et les données affichées.', swapBridgeStep:'3. Utiliser Swap et Bridge avec prudence', swapBridgeBody:'Vérifiez l’actif, le montant et le réseau de destination. Toute transaction réelle doit être vérifiée et approuvée dans votre portefeuille. La prise en charge dépend des réseaux et actifs disponibles.', agentStep:'4. Consulter NV Agent et NV News', agentBody:'Utilisez NV Agent pour explorer les informations chargées et ouvrez les sources originales de NV News pour vérifier le contexte.', historyStep:'5. Consulter Historique et Rapports', historyBody:'Consultez les hashes et événements enregistrés par ce navigateur. L’activité locale peut exclure les opérations effectuées hors de l’application ou avant cette fonctionnalité.', contact:'Nous contacter', contactDesc:'Questions, problèmes ou suggestions.', securityWarning:'Sécurité : ne partagez jamais votre phrase de récupération ni votre clé privée. Vérifiez le réseau, les adresses et les détails avant toute approbation.', soon:'BIENTÔT'
  },
  zh: {
    history:'历史记录', historyDesc:'此浏览器记录的交易哈希和操作。', hashesRegistered:'已记录的哈希', hashesFound:'个哈希', noHash:'目前尚无已记录的哈希。确认交易后，NV Protocol 可能会在此设备上显示记录。', hashEmpty:'目前没有活动记录。', copyHash:'复制哈希', recentActivity:'最近活动', localActivity:'NV Protocol 使用情况的本地记录。', noActivity:'尚无活动记录。',
    reports:'报告', reportsDesc:'应用活动的本地日志，可导出用于个人审计。', actionsRecorded:'已记录操作', txHashes:'交易哈希', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'活动日志', activityRegisterDesc:'根据已集成事件记录导航、钱包、已确认的 Swap/Bridge、智能助手和市场活动。', exportJson:'导出 JSON', clear:'清除', filterRecords:'筛选记录', allCategories:'所有类别', wallet:'钱包', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'导航', system:'系统', noFilter:'此筛选条件下没有记录。', privacy:'隐私：记录保存在此浏览器/设备的本地存储中，不会自动发送到服务器，也不会在设备之间同步。',
    settings:'设置', settingsDesc:'自定义部分使用体验。偏好设置保存在此浏览器中。', interfacePrefs:'界面偏好', compact:'紧凑界面', compactDesc:'缩小间距，以便在屏幕上显示更多内容。', reduceMotion:'减少动画', reduceMotionDesc:'减少界面动画和过渡效果。', securityReminders:'显示安全提醒', securityRemindersDesc:'在此设置页面显示安全提醒。', modeGoat:'Mode Goat', modeGoatDesc:'特殊模式正在准备中。', secureConfig:'安全配置', secureConfigDesc:'这些选项只影响视觉体验，不会更改网络、权限或交易规则。',
    help:'帮助', helpDesc:'NV Protocol 入门快速指南。', tutorial:'快速教程', dashboardStep:'1. 了解 Dashboard', dashboardBody:'查看市场指标、资产、TVL 和当前可用信息。', walletStep:'2. 连接钱包', walletBody:'打开钱包模块并连接兼容的钱包。请始终核对网络、地址和显示的数据。', swapBridgeStep:'3. 谨慎使用 Swap 和 Bridge', swapBridgeBody:'检查资产、金额和目标网络。每笔真实交易都必须在钱包中核对并批准。支持情况取决于可用网络和资产。', agentStep:'4. 查看 NV Agent 和 NV News', agentBody:'使用 NV Agent 浏览已加载的信息，并打开 NV News 原始来源核实背景。', historyStep:'5. 查看历史记录和报告', historyBody:'查看此浏览器记录的哈希和事件。本地活动可能不包括在应用外进行或此功能启用前的操作。', contact:'联系我们', contactDesc:'问题、故障或建议。', securityWarning:'安全提示：切勿分享助记词或私钥。批准交易前请核对网络、地址和详细信息。', soon:'即将推出'
  },
  ja: {
    history:'履歴', historyDesc:'このブラウザーで記録された取引ハッシュと操作。', hashesRegistered:'記録されたハッシュ', hashesFound:'件のハッシュ', noHash:'まだハッシュは記録されていません。取引が確認されると、この端末に表示される場合があります。', hashEmpty:'アクティビティはまだありません。', copyHash:'ハッシュをコピー', recentActivity:'最近のアクティビティ', localActivity:'NV Protocol の利用に関するローカル記録。', noActivity:'記録されたアクティビティはありません。',
    reports:'レポート', reportsDesc:'個人監査用にエクスポートできるアプリのローカル操作ログ。', actionsRecorded:'記録された操作', txHashes:'取引ハッシュ', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'アクティビティログ', activityRegisterDesc:'統合されたイベントに基づき、ナビゲーション、ウォレット、確認済みの Swap/Bridge、エージェント、市場を記録します。', exportJson:'JSON をエクスポート', clear:'消去', filterRecords:'記録を絞り込む', allCategories:'すべてのカテゴリ', wallet:'ウォレット', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'ナビゲーション', system:'システム', noFilter:'この条件に一致する記録はありません。', privacy:'プライバシー：記録はこのブラウザー/端末のローカルストレージに保存され、自動送信や端末間同期は行われません。',
    settings:'設定', settingsDesc:'利用体験の一部をカスタマイズできます。設定はこのブラウザーに保存されます。', interfacePrefs:'インターフェース設定', compact:'コンパクト表示', compactDesc:'余白を減らして画面に多くの内容を表示します。', reduceMotion:'アニメーションを減らす', reduceMotionDesc:'画面の動きや遷移を減らします。', securityReminders:'セキュリティ通知を表示', securityRemindersDesc:'この設定ページにセキュリティ通知を表示します。', modeGoat:'Mode Goat', modeGoatDesc:'特別モードを準備中です。', secureConfig:'安全な設定', secureConfigDesc:'これらの設定は表示のみを変更し、ネットワーク、権限、取引ルールは変更しません。',
    help:'ヘルプ', helpDesc:'NV Protocol のクイックスタートガイド。', tutorial:'クイックチュートリアル', dashboardStep:'1. Dashboard を確認', dashboardBody:'市場指標、資産、TVL、現在利用できる情報を確認します。', walletStep:'2. ウォレットを接続', walletBody:'ウォレットを開き、対応ウォレットを接続します。ネットワーク、アドレス、表示内容を必ず確認してください。', swapBridgeStep:'3. Swap と Bridge を慎重に利用', swapBridgeBody:'資産、金額、送信先ネットワークを確認します。実際の取引はウォレットで確認して承認する必要があります。対応状況は利用可能なネットワークと資産によります。', agentStep:'4. NV Agent と NV News を確認', agentBody:'NV Agent で読み込まれた情報を確認し、NV News の元ソースを開いて背景を確認します。', historyStep:'5. 履歴とレポートを確認', historyBody:'このブラウザーが記録したハッシュとイベントを確認します。アプリ外での操作や機能導入前の操作は含まれない場合があります。', contact:'お問い合わせ', contactDesc:'質問、問題、提案。', securityWarning:'セキュリティ：シードフレーズや秘密鍵を共有しないでください。取引承認前にネットワーク、アドレス、詳細を確認してください。', soon:'近日公開'
  },
  ko: {
    history:'기록', historyDesc:'이 브라우저에 기록된 거래 해시와 작업입니다.', hashesRegistered:'기록된 해시', hashesFound:'개 해시 발견', noHash:'아직 기록된 해시가 없습니다. 거래가 확인되면 이 기기에 표시될 수 있습니다.', hashEmpty:'아직 활동 기록이 없습니다.', copyHash:'해시 복사', recentActivity:'최근 활동', localActivity:'NV Protocol 사용에 대한 로컬 기록입니다.', noActivity:'기록된 활동이 없습니다.',
    reports:'보고서', reportsDesc:'개인 감사를 위해 내보낼 수 있는 앱 활동 로컬 로그입니다.', actionsRecorded:'기록된 작업', txHashes:'거래 해시', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'활동 로그', activityRegisterDesc:'통합된 이벤트에 따라 탐색, 지갑, 확인된 Swap/Bridge, 에이전트 및 시장 활동을 포함합니다.', exportJson:'JSON 내보내기', clear:'지우기', filterRecords:'기록 필터', allCategories:'모든 범주', wallet:'지갑', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'탐색', system:'시스템', noFilter:'이 필터에 해당하는 기록이 없습니다.', privacy:'개인정보: 기록은 이 브라우저/기기의 로컬 저장소에 남으며 서버로 자동 전송되거나 기기 간 동기화되지 않습니다.',
    settings:'설정', settingsDesc:'사용 환경의 일부를 맞춤 설정합니다. 설정은 이 브라우저에 저장됩니다.', interfacePrefs:'인터페이스 설정', compact:'컴팩트 인터페이스', compactDesc:'여백을 줄여 화면에 더 많은 내용을 표시합니다.', reduceMotion:'애니메이션 줄이기', reduceMotionDesc:'인터페이스의 움직임과 전환 효과를 줄입니다.', securityReminders:'보안 알림 표시', securityRemindersDesc:'이 설정 페이지에 보안 알림을 표시합니다.', modeGoat:'Mode Goat', modeGoatDesc:'특별 모드를 준비 중입니다.', secureConfig:'안전한 설정', secureConfigDesc:'이 옵션은 화면 표시만 변경하며 네트워크, 권한 또는 거래 규칙은 변경하지 않습니다.',
    help:'도움말', helpDesc:'NV Protocol 시작을 위한 빠른 안내입니다.', tutorial:'빠른 튜토리얼', dashboardStep:'1. 대시보드 살펴보기', dashboardBody:'시장 지표, 자산, TVL 및 현재 이용 가능한 정보를 확인하세요.', walletStep:'2. 지갑 연결', walletBody:'지갑 메뉴를 열고 호환되는 지갑을 연결하세요. 네트워크, 주소 및 표시된 정보를 항상 확인하세요.', swapBridgeStep:'3. Swap 및 Bridge 주의해서 사용', swapBridgeBody:'자산, 금액 및 대상 네트워크를 확인하세요. 실제 거래는 지갑에서 검토하고 승인해야 합니다. 지원 여부는 이용 가능한 네트워크와 자산에 따라 다릅니다.', agentStep:'4. NV Agent 및 NV News 확인', agentBody:'NV Agent로 로드된 정보를 살펴보고 NV News 원문 출처를 열어 맥락을 확인하세요.', historyStep:'5. 기록 및 보고서 확인', historyBody:'이 브라우저에 기록된 해시와 이벤트를 확인하세요. 앱 외부 작업이나 이 기능이 도입되기 전의 활동은 포함되지 않을 수 있습니다.', contact:'문의하기', contactDesc:'질문, 문제 또는 제안.', securityWarning:'보안: 시드 문구나 개인 키를 공유하지 마세요. 거래 승인 전에 네트워크, 주소 및 세부 정보를 확인하세요.', soon:'출시 예정'
  },
  hi: {
    history:'इतिहास', historyDesc:'इस ब्राउज़र में दर्ज लेन-देन हैश और कार्रवाइयाँ।', hashesRegistered:'दर्ज हैश', hashesFound:'हैश मिले', noHash:'अभी कोई हैश दर्ज नहीं है। पुष्टि किए गए लेन-देन के बाद NV Protocol इसे इस डिवाइस पर दिखा सकता है।', hashEmpty:'अभी कोई गतिविधि दर्ज नहीं है।', copyHash:'हैश कॉपी करें', recentActivity:'हाल की गतिविधि', localActivity:'NV Protocol उपयोग के स्थानीय रिकॉर्ड।', noActivity:'अभी कोई गतिविधि दर्ज नहीं है।',
    reports:'रिपोर्ट', reportsDesc:'व्यक्तिगत ऑडिट के लिए निर्यात योग्य ऐप गतिविधि लॉग।', actionsRecorded:'दर्ज कार्रवाइयाँ', txHashes:'लेन-देन हैश', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'गतिविधि लॉग', activityRegisterDesc:'एकीकृत घटनाओं के अनुसार नेविगेशन, वॉलेट, पुष्ट Swap/Bridge, एजेंट और बाज़ार शामिल हैं।', exportJson:'JSON निर्यात करें', clear:'साफ़ करें', filterRecords:'रिकॉर्ड फ़िल्टर करें', allCategories:'सभी श्रेणियाँ', wallet:'वॉलेट', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'नेविगेशन', system:'सिस्टम', noFilter:'इस फ़िल्टर के लिए कोई रिकॉर्ड नहीं है।', privacy:'गोपनीयता: रिकॉर्ड इस ब्राउज़र/डिवाइस के स्थानीय संग्रहण में रहते हैं; वे अपने-आप सर्वर पर नहीं भेजे जाते और डिवाइसों के बीच सिंक नहीं होते।',
    settings:'सेटिंग्स', settingsDesc:'अपने अनुभव के कुछ विवरण अनुकूलित करें। प्राथमिकताएँ इस ब्राउज़र में रहती हैं।', interfacePrefs:'इंटरफ़ेस प्राथमिकताएँ', compact:'कॉम्पैक्ट इंटरफ़ेस', compactDesc:'स्क्रीन पर अधिक सामग्री दिखाने के लिए खाली जगह कम करता है।', reduceMotion:'एनिमेशन कम करें', reduceMotionDesc:'इंटरफ़ेस की गति और ट्रांज़िशन कम करता है।', securityReminders:'सुरक्षा अनुस्मारक दिखाएँ', securityRemindersDesc:'इस सेटिंग पेज पर सुरक्षा अनुस्मारक दिखाता है।', modeGoat:'Mode Goat', modeGoatDesc:'एक विशेष मोड तैयार किया जा रहा है।', secureConfig:'सुरक्षित कॉन्फ़िगरेशन', secureConfigDesc:'ये विकल्प केवल दृश्य अनुभव बदलते हैं। नेटवर्क, अनुमतियाँ या लेन-देन नियम नहीं बदलते।',
    help:'सहायता', helpDesc:'NV Protocol शुरू करने के लिए त्वरित मार्गदर्शिका।', tutorial:'त्वरित ट्यूटोरियल', dashboardStep:'1. Dashboard देखें', dashboardBody:'बाज़ार संकेतक, संपत्तियाँ, TVL और उपलब्ध जानकारी देखें।', walletStep:'2. वॉलेट कनेक्ट करें', walletBody:'वॉलेट खोलें और संगत वॉलेट कनेक्ट करें। नेटवर्क, पता और प्रदर्शित विवरण हमेशा जाँचें।', swapBridgeStep:'3. Swap और Bridge सावधानी से उपयोग करें', swapBridgeBody:'संपत्ति, राशि और गंतव्य नेटवर्क की जाँच करें। हर वास्तविक लेन-देन की समीक्षा और स्वीकृति वॉलेट में होनी चाहिए। समर्थन उपलब्ध नेटवर्क और संपत्तियों पर निर्भर करता है।', agentStep:'4. NV Agent और NV News देखें', agentBody:'लोड की गई जानकारी देखने के लिए NV Agent का उपयोग करें और संदर्भ सत्यापित करने हेतु NV News के मूल स्रोत खोलें।', historyStep:'5. इतिहास और रिपोर्ट देखें', historyBody:'इस ब्राउज़र द्वारा दर्ज हैश और घटनाएँ देखें। ऐप के बाहर या इस सुविधा से पहले की गतिविधि शामिल न हो सकती है।', contact:'हमसे संपर्क करें', contactDesc:'प्रश्न, समस्याएँ या सुझाव।', securityWarning:'सुरक्षा: अपना सीड वाक्यांश या निजी कुंजी कभी साझा न करें। लेन-देन मंज़ूर करने से पहले नेटवर्क, पते और विवरण जाँचें।', soon:'जल्द आ रहा है'
  },
  ar: {
    history:'السجل', historyDesc:'معرّفات المعاملات والإجراءات المسجلة في هذا المتصفح.', hashesRegistered:'المعرّفات المسجلة', hashesFound:'معرّف(ات) تم العثور عليها', noHash:'لا توجد معرّفات مسجلة بعد. بعد تأكيد معاملة، قد يعرضها NV Protocol هنا على هذا الجهاز.', hashEmpty:'لا توجد أنشطة مسجلة بعد.', copyHash:'نسخ المعرّف', recentActivity:'النشاط الأخير', localActivity:'سجلات محلية لاستخدام NV Protocol.', noActivity:'لا توجد أنشطة مسجلة بعد.',
    reports:'التقارير', reportsDesc:'سجل محلي لنشاط التطبيق يمكن تصديره للمراجعة الشخصية.', actionsRecorded:'الإجراءات المسجلة', txHashes:'معرّفات المعاملات', agentNews:'NV Agent / News', globalMarkets:'Global Markets', activityRegister:'سجل النشاط', activityRegisterDesc:'يشمل التنقل والمحفظة وعمليات Swap/Bridge المؤكدة والوكيل والأسواق وفق الأحداث المدمجة.', exportJson:'تصدير JSON', clear:'مسح', filterRecords:'تصفية السجلات', allCategories:'كل الفئات', wallet:'المحفظة', swap:'Swap', bridge:'Bridge', agent:'NV Agent', news:'NV News', navigation:'التنقل', system:'النظام', noFilter:'لا توجد سجلات لهذا المرشح.', privacy:'الخصوصية: تبقى السجلات في التخزين المحلي لهذا المتصفح/الجهاز؛ لا تُرسل تلقائيًا إلى خادم ولا تتم مزامنتها بين الأجهزة.',
    settings:'الإعدادات', settingsDesc:'خصّص بعض تفاصيل تجربتك. تُحفظ التفضيلات في هذا المتصفح.', interfacePrefs:'تفضيلات الواجهة', compact:'واجهة مدمجة', compactDesc:'تقلل المسافات لعرض محتوى أكثر على الشاشة.', reduceMotion:'تقليل الرسوم المتحركة', reduceMotionDesc:'تقلل الحركة والانتقالات في الواجهة.', securityReminders:'إظهار تذكيرات الأمان', securityRemindersDesc:'يعرض تذكيرًا أمنيًا في صفحة الإعدادات هذه.', modeGoat:'Mode Goat', modeGoatDesc:'يجري إعداد وضع خاص.', secureConfig:'إعداد آمن', secureConfigDesc:'تغيّر هذه الخيارات المظهر فقط، ولا تغيّر الشبكات أو الأذونات أو قواعد المعاملات.',
    help:'المساعدة', helpDesc:'دليل سريع للبدء باستخدام NV Protocol.', tutorial:'دليل سريع', dashboardStep:'1. تعرّف على لوحة التحكم', dashboardBody:'تابع مؤشرات السوق والأصول وTVL والمعلومات المتاحة حاليًا.', walletStep:'2. اربط محفظتك', walletBody:'افتح قسم المحفظة واربط محفظة متوافقة. تحقق دائمًا من الشبكة والعنوان والبيانات المعروضة.', swapBridgeStep:'3. استخدم Swap وBridge بحذر', swapBridgeBody:'راجع الأصل والمبلغ وشبكة الوجهة. يجب مراجعة كل معاملة حقيقية والموافقة عليها في محفظتك. يعتمد الدعم على الشبكات والأصول المتاحة.', agentStep:'4. راجع NV Agent وNV News', agentBody:'استخدم NV Agent لاستكشاف المعلومات المحمّلة وافتح المصادر الأصلية لـ NV News للتحقق من السياق.', historyStep:'5. راجع السجل والتقارير', historyBody:'اطّلع على المعرّفات والأحداث التي سجلها هذا المتصفح. قد لا يشمل النشاط المحلي العمليات خارج التطبيق أو قبل توفر هذه الميزة.', contact:'اتصل بنا', contactDesc:'أسئلة أو مشكلات أو اقتراحات.', securityWarning:'الأمان: لا تشارك عبارة الاسترداد أو المفتاح الخاص مطلقًا. تحقق من الشبكة والعناوين والتفاصيل قبل الموافقة على أي معاملة.', soon:'قريبًا'
  }
};
function useModuleCopy() {
  const { locale } = useI18n();
  return (key: ModuleCopyKey) => MODULE_COPY[locale]?.[key] ?? MODULE_COPY.en[key];
}


function useActivityFeed() {
  const [items, setItems] = useState<NVActivity[]>(() => readNVActivity());
  useEffect(() => {
    const refresh = () => setItems(readNVActivity());
    window.addEventListener('nv-activity-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('nv-activity-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return [items, setItems] as const;
}

function formatDate(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(timestamp);
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function HistoryModule() {
  const tx = useModuleCopy();
  const { locale } = useI18n();
  const [items] = useActivityFeed();
  const hashes = items.filter(item => item.txHash);
  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      logNVActivity({ category: 'system', action: 'Hash copiado', details: hash });
    } catch {
      // The hash remains visible for manual copying when clipboard access is unavailable.
    }
  };
  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-primary mb-2"><Clock3 size={18} /><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div>
        <h1 className="text-2xl font-bold">{tx('history')}</h1>
        <p className={subtle + ' mt-1'}>{tx('historyDesc')}</p>
      </div>
      <div className={panel}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h2 className={titleClass}>{tx('hashesRegistered')}</h2><p className={subtle + ' mt-1'}>{hashes.length} {tx('hashesFound')}</p></div>
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck size={20} /></div>
        </div>
        {hashes.length === 0 ? <EmptyState>{tx('noHash')}</EmptyState> : (
          <div className="space-y-3">
            {hashes.map(item => (
              <div key={item.id} className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{item.action}</div>
                  <span className="text-xs text-muted-foreground">{formatDate(item.timestamp, locale)}</span>
                </div>
                <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{item.txHash}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => void copyHash(item.txHash!)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"><Copy size={13}/> {tx('copyHash')}</button>
                  {item.network && <span className="text-xs text-muted-foreground">{item.network}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={panel}>
        <h2 className={titleClass}>{tx('recentActivity')}</h2>
        <p className={subtle + ' mt-1 mb-4'}>{tx('localActivity')}</p>
        {items.length === 0 ? <EmptyState>{tx('noActivity')}</EmptyState> : (
          <div className="space-y-2">{items.slice(0, 12).map(item => <div key={item.id} className="flex gap-3 rounded-lg bg-secondary/30 p-3"><Activity size={15} className="mt-0.5 text-primary shrink-0"/><div className="min-w-0 flex-1"><div className="text-sm font-medium">{item.action}</div>{item.details && <div className="text-xs text-muted-foreground mt-1 break-words">{item.details}</div>}<div className="text-[11px] text-muted-foreground mt-1">{formatDate(item.timestamp, locale)}</div></div></div>)}</div>
        )}
      </div>
    </section>
  );
}

export function ReportsModule() {
  const tx = useModuleCopy();
  const { locale } = useI18n();
  const [items] = useActivityFeed();
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => filter === 'all' ? items : items.filter(item => item.category === filter), [items, filter]);
  const counts = useMemo(() => ({
    total: items.length,
    tx: items.filter(item => item.txHash).length,
    agent: items.filter(item => item.category === 'agent' || item.category === 'news').length,
    markets: items.filter(item => item.category === 'markets').length,
  }), [items]);
  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), product: 'NV Protocol', activity: filtered }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nv-protocol-relatorio.json';
    anchor.click();
    URL.revokeObjectURL(url);
    logNVActivity({ category: 'system', action: 'Relatório exportado', details: `${filtered.length} registros` });
  };
  const clearReport = () => {
    if (window.confirm('Apagar o histórico de atividades salvo neste navegador? Esta ação não pode ser desfeita.')) clearNVActivity();
  };
  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-primary mb-2"><FileText size={18}/><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div>
        <h1 className="text-2xl font-bold">{tx('reports')}</h1>
        <p className={subtle + ' mt-1'}>Registro local de ações do app, com exportação para auditoria pessoal.</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[[tx('actionsRecorded'), counts.total], [tx('txHashes'), counts.tx], [tx('agentNews'), counts.agent], [tx('globalMarkets'), counts.markets]].map(([label, value]) => <div key={String(label)} className={panel}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-bold tabular-nums">{value}</div></div>)}
      </div>
      <div className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className={titleClass}>{tx('activityRegister')}</h2><p className={subtle + ' mt-1'}>Inclui navegação, carteira, swaps/bridges confirmados, agente e mercados conforme os eventos integrados.</p></div><div className="flex gap-2"><button onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Download size={14}/> {tx('exportJson')}</button><button onClick={clearReport} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><Trash2 size={14}/> {tx('clear')}</button></div></div>
        <label className="text-xs text-muted-foreground">{tx('filterRecords')}</label>
        <select value={filter} onChange={event => setFilter(event.target.value)} className="mt-1 mb-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <option value="all">{tx('allCategories')}</option><option value="wallet">{tx('wallet')}</option><option value="swap">{tx('swap')}</option><option value="bridge">{tx('bridge')}</option><option value="agent">{tx('agent')}</option><option value="news">{tx('news')}</option><option value="markets">{tx('globalMarkets')}</option><option value="navigation">{tx('navigation')}</option><option value="system">{tx('system')}</option>
        </select>
        {filtered.length === 0 ? <EmptyState>{tx('noFilter')}</EmptyState> : <div className="space-y-2">{filtered.map(item => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/50 p-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Activity size={15}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{item.action}</strong><span className="text-[11px] text-muted-foreground">{formatDate(item.timestamp, locale)}</span></div><div className="mt-1 text-xs text-muted-foreground">{item.category}{item.network ? ' · ' + item.network : ''}</div>{item.details && <p className="mt-1 text-xs break-words">{item.details}</p>}{item.txHash && <p className="mt-1 break-all font-mono text-xs text-primary">{item.txHash}</p>}</div></div>)}</div>}
      </div>
      <p className="text-xs text-muted-foreground">{tx('privacy')}</p>
    </section>
  );
}

interface NVSettings { compact: boolean; reducedMotion: boolean; confirmations: boolean; }
const SETTINGS_KEY = 'nv_protocol_settings_v1';
const DEFAULT_SETTINGS: NVSettings = { compact: false, reducedMotion: false, confirmations: true };

export function SettingsModule() {
  const tx = useModuleCopy();
  const [settings, setSettings] = useState<NVSettings>(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return DEFAULT_SETTINGS; }
  });
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.nvCompact = settings.compact ? 'true' : 'false';
    document.documentElement.dataset.nvReducedMotion = settings.reducedMotion ? 'true' : 'false';
    const styleId = 'nv-user-preferences-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
    const compactCss = settings.compact ? 'html[data-nv-compact="true"] .p-5{padding:1rem!important}html[data-nv-compact="true"] .gap-5{gap:1rem!important}' : '';
    const motionCss = settings.reducedMotion ? '*,*::before,*::after{scroll-behavior:auto!important;animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}' : '';
    style.textContent = compactCss + motionCss;
  }, [settings]);
  const update = (key: keyof NVSettings, value: boolean) => setSettings(previous => ({ ...previous, [key]: value }));
  const Toggle = ({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
      <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-primary"/>
    </label>
  );
  return (
    <section className="space-y-5">
      <div><div className="flex items-center gap-2 text-primary mb-2"><Settings2 size={18}/><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div><h1 className="text-2xl font-bold">{tx('settings')}</h1><p className={subtle + ' mt-1'}>Personalize alguns detalhes da sua experiência. As preferências ficam neste navegador.</p></div>
      <div className={panel + ' space-y-3'}>
        <h2 className={titleClass}>{tx('interfacePrefs')}</h2>
        <Toggle label={tx('compact')} description={tx('compactDesc')} value={settings.compact} onChange={value => update('compact', value)}/>
        <Toggle label={tx('reduceMotion')} description={tx('reduceMotionDesc')} value={settings.reducedMotion} onChange={value => update('reducedMotion', value)}/>
        <Toggle label={tx('securityReminders')} description={tx('securityRemindersDesc')} value={settings.confirmations} onChange={value => update('confirmations', value)}/>
      </div>
      {settings.confirmations && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted-foreground">{tx('securityWarning')}</div>}
      <div className={panel}>
        <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-400"><Sparkles size={20}/></div><div><h2 className={titleClass}>{tx('modeGoat')}</h2><p className={subtle + ' mt-1'}>{tx('modeGoatDesc')}</p></div></div>
        <button disabled className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold text-muted-foreground opacity-60" aria-label="Mode Goat em breve"><Sparkles size={16}/> MODE GOAT <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{tx('soon')}</span></button>
      </div>
      <div className={panel + ' flex items-start gap-3'}><Palette size={18} className="mt-0.5 text-primary"/><div><h2 className="text-sm font-semibold">{tx('secureConfig')}</h2><p className={subtle + ' mt-1'}>{tx('secureConfigDesc')}</p></div></div>
    </section>
  );
}

export function HelpModule() {
  const tx = useModuleCopy();
  const [expanded, setExpanded] = useState<number | null>(0);
  const steps = [
    { title: tx('dashboardStep'), body: tx('dashboardBody') },
    { title: tx('walletStep'), body: tx('walletBody') },
    { title: tx('swapBridgeStep'), body: tx('swapBridgeBody') },
    { title: tx('agentStep'), body: tx('agentBody') },
    { title: tx('historyStep'), body: tx('historyBody') },
  ];
  return (
    <section className="space-y-5">
      <div><div className="flex items-center gap-2 text-primary mb-2"><BookOpen size={18}/><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div><h1 className="text-2xl font-bold">{tx('help')}</h1><p className={subtle + ' mt-1'}>Um guia rápido para começar a usar o NV Protocol.</p></div>
      <div className={panel + ' space-y-2'}><h2 className={titleClass + ' mb-3'}>{tx('tutorial')}</h2>{steps.map((step, index) => <div key={step.title} className="rounded-xl border border-border/60"><button onClick={() => setExpanded(expanded === index ? null : index)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-medium">{step.title}<ChevronRight size={15} className={expanded === index ? 'rotate-90 text-primary transition-transform' : 'text-muted-foreground transition-transform'}/></button>{expanded === index && <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{step.body}</p>}</div>)}</div>
      <div className={panel}><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Mail size={20}/></div><div><h2 className={titleClass}>{tx('contact')}</h2><p className={subtle + ' mt-1'}>Dúvidas, problemas ou sugestões.</p></div></div><a href="mailto:nextvaultprotocol@gmail.com" className="mt-4 inline-flex items-center gap-2 break-all text-sm font-medium text-primary hover:underline">nextvaultprotocol@gmail.com <ExternalLink size={14}/></a></div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted-foreground">{tx('securityWarning')}</div>
    </section>
  );
}

export function logNVModuleView(view: string) {
  const categories: Record<string, NVActivity['category']> = {
    swap: 'swap', bridge: 'bridge', intelligence: 'agent', solana: 'wallet',
    carteira: 'wallet', dashboard: 'markets', historico: 'navigation',
    relatorios: 'navigation', configuracoes: 'navigation', ajuda: 'navigation',
  };
  const names: Record<string, string> = {
    swap: 'Módulo Swap aberto', bridge: 'Módulo Bridge aberto',
    intelligence: 'NV Agent / NV News aberto', solana: 'Módulo Solana aberto',
    carteira: 'Módulo Carteira aberto', dashboard: 'Dashboard / Global Markets aberto',
    historico: 'Histórico aberto', relatorios: 'Relatórios aberto',
    configuracoes: 'Configurações abertas', ajuda: 'Ajuda aberta',
  };
  logNVActivity({ category: categories[view] ?? 'navigation', action: names[view] ?? 'Módulo aberto', details: view });
}
