import type { AgentAction } from './intelligence';

export type NVIntent='transfer'|'swap'|'bridge'|'payment'|'market'|'wallet'|'news'|'tvl'|'chat'|'cancel'|'confirm';
export interface ParsedNVTurn{intent:NVIntent;params:Record<string,string|number|null>;confidence:number;}
const TOKENS=['USDC','EURC','ETH','SOL','POL','MATIC','AVAX','S','MON','SEI','XDC','HYPE','PLUME'];
const NETS:Array<[RegExp,string]>=[
 [/arbitrum sepolia/i,'arbitrum-sepolia'],[/optimism sepolia/i,'optimism-sepolia'],[/ethereum sepolia|sepolia/i,'sepolia'],[/base sepolia/i,'base-sepolia'],[/arc testnet/i,'arc-testnet'],[/arc mainnet/i,'arc-mainnet'],
 [/world chain/i,'world-chain'],[/xdc network/i,'xdc'],[/hyper ?evm/i,'hyperevm'],[/arbitrum/i,'arbitrum'],[/optimism/i,'optimism'],[/ethereum/i,'ethereum'],[/polygon/i,'polygon'],[/avalanche/i,'avalanche'],[/unichain/i,'unichain'],[/linea/i,'linea'],[/codex/i,'codex'],[/sonic/i,'sonic'],[/monad/i,'monad'],[/sei/i,'sei'],[/ink/i,'ink'],[/plume/i,'plume'],[/edge/i,'edge'],[/base/i,'base'],[/arc/i,'arc-mainnet']
];
function amount(q:string){
 const labelled=q.match(/(?:valor(?:\s+de)?|amount(?:\s+of)?|value(?:\s+of)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
 const tokenAmount=q.match(/\b(?:USDC|EURC|ETH|SOL|POL|MATIC|AVAX)\s+(\d+(?:[.,]\d+)?)/i);
 const plain=q.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/);
 const raw=labelled?.[1]??tokenAmount?.[1]??plain?.[1];if(!raw)return null;const n=Number(raw.replace(',','.'));return n>0?n:null;
}
function tokens(q:string){return TOKENS.flatMap(t=>{const m=new RegExp('\\b'+t+'\\b','i').exec(q);return m?[{v:t==='MATIC'?'POL':t,i:m.index}]:[]}).sort((a,b)=>a.i-b.i).map(x=>x.v);}
function networks(q:string){const out:{v:string;i:number}[]=[];let work=q;for(const [re,v] of NETS){const m=re.exec(work);if(m){out.push({v,i:m.index});work=work.slice(0,m.index)+' '.repeat(m[0].length)+work.slice(m.index+m[0].length)}}return out.sort((a,b)=>a.i-b.i).map(x=>x.v);}
export function parseNVTurn(text:string,pending?:AgentAction|null):ParsedNVTurn{
 const q=text.trim(),l=q.toLowerCase(),ts=tokens(q),ns=networks(q),a=amount(q),addr=q.match(/0x[0-9a-fA-F]{40}/)?.[0]??null;
 if(/^(cancel(e|ar)?|desistir|pare|parar|stop|deixa pra l[aá])\b/i.test(q))return{intent:'cancel',params:{},confidence:1};
 if(/^(confirm(e|ar)?|execute|executar|prossiga|prosseguir|pode executar|pode fazer|sim|yes|go)\b/i.test(q))return{intent:'confirm',params:{},confidence:1};
 let intent:NVIntent|null=null;
 if(/\b(bridge|ponte|cross[- ]?chain)\b/i.test(q)||ns.length>=2)intent='bridge';
 else if(/\b(swap|trocar|troque|converter|converta)\b/i.test(q)||(a&&ts.length>=2&&/\b(para|por|to|for)\b/i.test(q)))intent='swap';
 else if(/\b(transferir|transferencia|transferência|enviar|envie|send)\b/i.test(q)||addr)intent='transfer';
 else if(/\b(comprar|compre|buy|pagamento|payment)\b/i.test(q))intent='payment';
 else if(pending)intent=pending.type as NVIntent;
 else if(/\b(tvl|total value locked)\b/i.test(q))intent='tvl';
 else if(/\b(carteira|wallet|saldo|balance)\b/i.test(q))intent='wallet';
 else if(/\b(noticias|notícias|news)\b/i.test(q))intent='news';
 else if(/\b(pre[cç]o|price|mercado|market|btc|bitcoin)\b/i.test(q))intent='market';
 else intent='chat';
 const params:Record<string,string|number|null>={};
 if(a)params.amount=a;if(addr)params.recipient=addr;
 if(intent==='swap'){if(ts[0])params.sourceToken=ts[0];if(ts[1])params.destinationToken=ts[1];if(ns[0])params.network=ns[0];}
 if(intent==='transfer'){if(ts[0])params.token=ts[0];if(ns[0])params.network=ns[0];}
 if(intent==='bridge'){if(ns[0])params.fromNetwork=ns[0];if(ns[1])params.toNetwork=ns[1];}
 if(intent==='payment'){
   if(/(?:skin|premium).*1000|1000.*(?:skin|premium)/i.test(l))params.product='premium-1000';
   else if(/(?:skin|premium).*500|500.*(?:skin|premium)/i.test(l))params.product='premium-500';
   else if(/trimestral|quarterly|300\s*xp/i.test(l))params.product='xp-quarterly';
   else if(/semanal|weekly|60\s*xp/i.test(l))params.product='xp-weekly';
   else if(/di[aá]rio|daily|30\s*xp/i.test(l))params.product='xp-daily';
 }
 return{intent,params,confidence:intent==='chat'?.3:1};
}
export function mergeNVAction(current:AgentAction|undefined|null,turn:ParsedNVTurn):AgentAction|null{
 if(!['swap','bridge','transfer','payment'].includes(turn.intent))return current??null;
 const type=turn.intent as AgentAction['type']; const base=current?.type===type?current.params??{}:{};
 return{type,executeInChat:true,navigateTo:type==='transfer'?'consulte':type==='payment'?'perfil':type,params:{...base,...turn.params}};
}
export type NVActionSlot='amount'|'sourceToken'|'destinationToken'|'network'|'fromNetwork'|'toNetwork'|'token'|'recipient'|'product';
export function missingNVAction(a:AgentAction):NVActionSlot[]{const p=a.params??{},m:NVActionSlot[]=[];
 if(a.type==='swap'){if(!(Number(p.amount)>0))m.push('amount');if(!p.sourceToken)m.push('sourceToken');if(!p.destinationToken)m.push('destinationToken');}
 if(a.type==='bridge'){if(!(Number(p.amount)>0))m.push('amount');if(!p.fromNetwork)m.push('fromNetwork');if(!p.toNetwork)m.push('toNetwork');}
 if(a.type==='transfer'){if(!(Number(p.amount)>0))m.push('amount');if(!p.token)m.push('token');if(!p.recipient)m.push('recipient');}
 if(a.type==='payment'&&!p.product)m.push('product');return m;}
export function summarizeNVAction(a:AgentAction){const p=a.params??{};if(a.type==='swap')return `Swap: ${p.amount??'?'} ${p.sourceToken??'?'} → ${p.destinationToken??'?'}${p.network?' · '+p.network:''}`;if(a.type==='bridge')return `Bridge: ${p.amount??'?'} USDC · ${p.fromNetwork??'?'} → ${p.toNetwork??'?'}`;if(a.type==='transfer')return `Transferência: ${p.amount??'?'} ${p.token??'?'} → ${p.recipient??'?'}`;return `Pagamento: ${p.product??'?'}`;}
