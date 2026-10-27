// NV Agent deterministic language coverage.
// 20 intent families x 50 natural utterance patterns = 1,000 recognized phrases.
// This complements (not replaces) the semantic LLM layer and keeps an offline fallback.

export type UtteranceIntent =
  | 'action_transfer' | 'action_bridge' | 'action_swap' | 'action_payment'
  | 'market_price' | 'market_top' | 'market_movers' | 'market_status'
  | 'tvl_chain' | 'tvl_top' | 'wallet_evm' | 'wallet_solana'
  | 'news' | 'capabilities' | 'bridge_info' | 'payment_info'
  | 'mode_assisted' | 'mode_authorized' | 'greeting' | 'thanks';

const seeds: Record<UtteranceIntent, string[]> = {
 action_transfer:['envie usdc para','mande usdc para','transfira usdc para','quero enviar usdc','faça uma transferência','fazer transferência','enviar tokens para','mandar tokens para','pagar endereço','send usdc to'],
 action_bridge:['faça bridge de','fazer bridge de','execute bridge de','mova usdc de','mover usdc entre redes','leve usdc de','transferir entre redes','cross chain de','bridge usdc from','i want to bridge'],
 action_swap:['faça swap de','fazer swap de','troque por','trocar por','converta para','converter para','quero trocar','execute swap','swap tokens','i want to swap'],
 action_payment:['compre a skin','comprar skin','compre xp','comprar xp','quero comprar','desbloqueie','comprar com usdc','faça uma compra','buy xp','buy skin'],
 market_price:['preço do btc','quanto vale eth','cotação do bitcoin','valor do ethereum','preço atual','quanto está','qual o preço','cotação atual','market price','how much is'],
 market_top:['top criptos','maiores criptos','ranking cripto','principais ativos','maiores moedas','top stablecoins','ranking de ativos','maiores por market cap','top crypto','largest assets'],
 market_movers:['maiores altas','maiores quedas','quem mais subiu','quem mais caiu','melhores desempenhos','piores desempenhos','ativos em alta','ativos em queda','top gainers','top losers'],
 market_status:['como está o mercado','resumo do mercado','panorama do mercado','situação do mercado','visão do mercado','mercado agora','cenário atual','o que está acontecendo no mercado','market overview','market status'],
 tvl_chain:['tvl da base','tvl da arc','tvl do ethereum','valor bloqueado na base','quanto está bloqueado','tvl desta rede','defi tvl','chain tvl','tvl da rede','protocol tvl'],
 tvl_top:['maiores tvls','ranking de tvl','top tvl','redes com maior tvl','maior valor bloqueado','ranking defi','top chains por tvl','principais tvls','largest tvl','top chains'],
 wallet_evm:['minha carteira','meu saldo','saldo evm','carteira conectada','meu endereço','qual minha rede','saldo usdc','minha wallet','evm wallet','wallet balance'],
 wallet_solana:['carteira solana','saldo solana','minha phantom','solana conectada','endereço solana','saldo sol','minha solana','sol wallet','solana wallet','phantom balance'],
 news:['notícias do mercado','notícias de cripto','o que aconteceu hoje','últimas notícias','novidades do mercado','notícias recentes','eventos recentes','market news','latest news','breaking news'],
 capabilities:['o que você faz','como pode me ajudar','quais suas funções','o que você consegue fazer','suas capacidades','como usar o agente','me ajude','o que sabe fazer','what can you do','your capabilities'],
 bridge_info:['como funciona bridge','explique bridge','o que é cctp','rotas da bridge','redes da bridge','bridge suporta quais redes','taxa da bridge','tempo da bridge','how bridge works','bridge routes'],
 payment_info:['como pagar','como funciona pagamento','pagamentos no nv','compras no nv','pagar com usdc','sistema de pagamento','como comprar xp','como comprar skin','how to pay','payment system'],
 mode_assisted:['modo assistido','modo manual assistido','ative modo assistido','usar modo assistido','quero revisar transações','modo com assinatura','manual assisted mode','assisted mode','activate assisted','use assisted'],
 mode_authorized:['modo autorizado','ative modo autorizado','usar modo autorizado','política de autorização','autorizar operações','limites de autorização','authorized mode','activate authorized','authorization policy','use authorized'],
 greeting:['oi','olá','bom dia','boa tarde','boa noite','e aí','fala nv','olá agente','hello','hey'],
 thanks:['obrigado','obrigada','valeu','agradeço','muito obrigado','perfeito obrigado','ótimo valeu','thanks','thank you','appreciate it'],
};

const prefixes=['','por favor ','nv, ','agente, ','preciso que '];
const suffixes=['',' agora',' por favor',' no nv',' para mim'];

function normalize(s:string){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9x]+/g,' ').trim();}

export const NV_AGENT_UTTERANCES: ReadonlyArray<{intent:UtteranceIntent;phrase:string}> =
 (Object.entries(seeds) as [UtteranceIntent,string[]][]).flatMap(([intent,list]) =>
   list.flatMap((seed,i)=>prefixes.map((prefix,j)=>({intent,phrase:normalize(prefix+seed+suffixes[(i+j)%suffixes.length])})))
 );

export const NV_AGENT_UTTERANCE_COUNT = NV_AGENT_UTTERANCES.length; // exactly 1,000

export function matchNVAgentUtterance(input:string):UtteranceIntent|null{
 const q=normalize(input);
 if(!q)return null;
 let best:{intent:UtteranceIntent;score:number}|null=null;
 for(const item of NV_AGENT_UTTERANCES){
   if(q===item.phrase)return item.intent;
   const core=item.phrase.replace(/^(por favor |nv |agente |preciso que )/,'').replace(/ (agora|por favor|no nv|para mim)$/,'');
   if(core.length>=4&&q.includes(core)){
     const score=core.length;
     if(!best||score>best.score)best={intent:item.intent,score};
   }
 }
 return best?.intent??null;
}
