import type { AgentAction } from './intelligence';

export type NVIntent='transfer'|'swap'|'bridge'|'payment'|'market'|'wallet'|'news'|'tvl'|'chat'|'cancel'|'confirm';
export interface ParsedNVTurn{intent:NVIntent;params:Record<string,string|number|null>;confidence:number;}
export interface NVActionGuard{valid:boolean;issues:string[];}
// Execution-token allowlist intentionally remains unchanged: it protects the
// already validated Swap / Bridge / Transfer executors. Parser improvements
// below only make language/slot recognition more flexible.
const TOKENS=['USDC','EURC','ETH','SOL','POL','MATIC','AVAX','S','MON','SEI','XDC','HYPE','PLUME'];
const NETS:Array<[RegExp,string]>=[
 [/arbitrum sepolia/i,'arbitrum-sepolia'],[/optimism sepolia/i,'optimism-sepolia'],[/ethereum sepolia|sepolia/i,'sepolia'],[/base sepolia/i,'base-sepolia'],[/arc testnet/i,'arc-testnet'],[/arc mainnet/i,'arc-mainnet'],
 [/world chain/i,'world-chain'],[/xdc network/i,'xdc'],[/hyper ?evm/i,'hyperevm'],[/arbitrum/i,'arbitrum'],[/optimism/i,'optimism'],[/ethereum/i,'ethereum'],[/polygon/i,'polygon'],[/avalanche/i,'avalanche'],[/unichain/i,'unichain'],[/linea/i,'linea'],[/codex/i,'codex'],[/sonic/i,'sonic'],[/monad/i,'monad'],[/sei/i,'sei'],[/ink/i,'ink'],[/plume/i,'plume'],[/edge/i,'edge'],[/base/i,'base'],[/arc/i,'arc-mainnet']
];
function amount(q:string){
 const number='(\\d+(?:[.,]\\d+)?)';
 const labelled=q.match(new RegExp('(?:valor(?:\\s+de)?|amount(?:\\s+of)?|value(?:\\s+of)?|quantia|montante|enviar|envie|send|swap|bridge)\\s*[:=]?\\s*'+number,'i'));
 const beforeToken=q.match(new RegExp(number+'\\s*(?:USDC|EURC|ETH|SOL|POL|MATIC|AVAX)\\b','i'));
 const afterToken=q.match(new RegExp('\\b(?:USDC|EURC|ETH|SOL|POL|MATIC|AVAX)\\s*'+number,'i'));
 const plain=q.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/);
 const raw=labelled?.[1]??beforeToken?.[1]??afterToken?.[1]??plain?.[1];
 if(!raw)return null;
 const n=Number(raw.replace(',','.'));return Number.isFinite(n)&&n>0?n:null;
}
function tokens(q:string){return TOKENS.flatMap(t=>{const m=new RegExp('\\b'+t+'\\b','i').exec(q);return m?[{v:t==='MATIC'?'POL':t,i:m.index}]:[]}).sort((a,b)=>a.i-b.i).map(x=>x.v);}
function networks(q:string){const out:{v:string;i:number}[]=[];let work=q;for(const [re,v] of NETS){const m=re.exec(work);if(m){out.push({v,i:m.index});work=work.slice(0,m.index)+' '.repeat(m[0].length)+work.slice(m.index+m[0].length)}}return out.sort((a,b)=>a.i-b.i).map(x=>x.v);}
export function parseNVTurn(text:string,pending?:AgentAction|null):ParsedNVTurn{
 const q=text.trim(),l=q.toLowerCase(),ts=tokens(q),ns=networks(q),a=amount(q),addr=q.match(/0x[0-9a-fA-F]{40}/)?.[0]??null;
 if(/^(cancel(e|ar)?|cancela|desistir|pare|parar|stop|abortar|aborte|esquece|deixa pra l[aá]|n[aã]o execute|nao execute)\b/i.test(q))return{intent:'cancel',params:{},confidence:1};
 if(/^(confirm(e|ar)?|confirmo|execute|executar|pode executar|pode fazer|prossiga|prosseguir|continue|continuar|manda ver|sim|yes|go|ok|okay)\b/i.test(q))return{intent:'confirm',params:{},confidence:1};
 let intent:NVIntent|null=null;
 if(/\b(bridge|bridging|ponte|cross[- ]?chain|entre redes|outra rede)\b/i.test(q)||ns.length>=2)intent='bridge';
 else if(/\b(swap|trocar|troque|converter|converta|permutar|exchange)\b/i.test(q)||(a&&ts.length>=2&&/\b(para|por|to|for|em)\b/i.test(q)))intent='swap';
 else if(/\b(transferir|transfira|transferencia|transferência|enviar|envie|mandar|mande|remeter|send)\b/i.test(q)||addr)intent='transfer';
 else if(/\b(comprar|compre|buy|pagamento|payment)\b/i.test(q))intent='payment';
 else if(pending)intent=pending.type as NVIntent;
 else if(/\b(tvl|total value locked)\b/i.test(q))intent='tvl';
 else if(/\b(carteira|wallet|saldo|balance)\b/i.test(q))intent='wallet';
 else if(/\b(noticias|notícias|news)\b/i.test(q))intent='news';
 else if(/\b(pre[cç]o|price|mercado|market|btc|bitcoin)\b/i.test(q))intent='market';
 else intent='chat';
 const params:Record<string,string|number|null>={};
 // Pending-action aware corrections: short follow-ups update only the named
 // slot and preserve the rest of the already prepared operation.
 const correction=/\b(na verdade|corrig|mude|muda|troque para|use|usar|altere|alterar|instead|actually|change|set)\b/i.test(q);
 if(a)params.amount=a;if(addr)params.recipient=addr;
 if(intent==='swap'){
   if(ts[0])params.sourceToken=ts[0];if(ts[1])params.destinationToken=ts[1];if(ns[0])params.network=ns[0];
   if(pending?.type==='swap'&&correction&&ts.length===1){
     const pp=pending.params??{};
     if(/\b(destino|destination|receber|receive|para|to)\b/i.test(q)) { delete params.sourceToken; params.destinationToken=ts[0]; }
     else if(/\b(origem|source|de|from)\b/i.test(q)) params.sourceToken=ts[0];
     else if(pp.sourceToken&&!pp.destinationToken) { delete params.sourceToken; params.destinationToken=ts[0]; }
   }
 }
 if(intent==='transfer'){if(ts[0])params.token=ts[0];if(ns[0])params.network=ns[0];}
 if(intent==='bridge'){
   if(ns[0])params.fromNetwork=ns[0];if(ns[1])params.toNetwork=ns[1];
   if(pending?.type==='bridge'&&ns.length===1){
     const pp=pending.params??{};
     if(/\b(destino|destination|para|to)\b/i.test(q)) { delete params.fromNetwork; params.toNetwork=ns[0]; }
     else if(/\b(origem|source|de|from)\b/i.test(q)) params.fromNetwork=ns[0];
     else if(pp.fromNetwork&&!pp.toNetwork) { delete params.fromNetwork; params.toNetwork=ns[0]; }
   }
 }
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
 const type=turn.intent as AgentAction['type'];
 // Same operation: patch only recognized slots. A genuinely different intent
 // starts a fresh action, preventing stale parameters from leaking across tasks.
 const base=current?.type===type?current.params??{}:{};
 return{type,executeInChat:true,navigateTo:type==='transfer'?'consulte':type==='payment'?'perfil':type,params:{...base,...turn.params}};
}
export type NVActionSlot='amount'|'sourceToken'|'destinationToken'|'network'|'fromNetwork'|'toNetwork'|'token'|'recipient'|'product';
export function missingNVAction(a:AgentAction):NVActionSlot[]{const p=a.params??{},m:NVActionSlot[]=[];
 if(a.type==='swap'){if(!(Number(p.amount)>0))m.push('amount');if(!p.sourceToken)m.push('sourceToken');if(!p.destinationToken)m.push('destinationToken');}
 if(a.type==='bridge'){if(!(Number(p.amount)>0))m.push('amount');if(!p.fromNetwork)m.push('fromNetwork');if(!p.toNetwork)m.push('toNetwork');}
 if(a.type==='transfer'){if(!(Number(p.amount)>0))m.push('amount');if(!p.token)m.push('token');if(!p.recipient)m.push('recipient');}
 if(a.type==='payment'&&!p.product)m.push('product');return m;}
export function validateNVAction(a:AgentAction):NVActionGuard{
 const p=a.params??{},issues:string[]=[];
 const amt=Number(p.amount);
 if(['swap','bridge','transfer'].includes(a.type)&&(!Number.isFinite(amt)||amt<=0))issues.push('invalid_amount');
 if(a.type==='swap'&&p.sourceToken&&p.destinationToken&&p.sourceToken===p.destinationToken)issues.push('same_token');
 if(a.type==='bridge'&&p.fromNetwork&&p.toNetwork&&p.fromNetwork===p.toNetwork)issues.push('same_network');
 if(a.type==='transfer'&&p.recipient&&!/^0x[0-9a-fA-F]{40}$/.test(String(p.recipient)))issues.push('invalid_recipient');
 return{valid:issues.length===0,issues};
}
export function nextNVActionSlot(a:AgentAction):NVActionSlot|null{return missingNVAction(a)[0]??null;}
export function canConfirmNVAction(a:AgentAction):boolean{return missingNVAction(a).length===0&&validateNVAction(a).valid;}
export function summarizeNVAction(a:AgentAction){const p=a.params??{};if(a.type==='swap')return `Swap: ${p.amount??'?'} ${p.sourceToken??'?'} → ${p.destinationToken??'?'}${p.network?' · '+p.network:''}`;if(a.type==='bridge')return `Bridge: ${p.amount??'?'} USDC · ${p.fromNetwork??'?'} → ${p.toNetwork??'?'}`;if(a.type==='transfer')return `Transferência: ${p.amount??'?'} ${p.token??'?'} → ${p.recipient??'?'}`;return `Pagamento: ${p.product??'?'}`;}


// Pure helper for UI/tests: applies a conversational follow-up without ever
// executing anything. Execution remains owned by the validated action layer.
export function updatePendingNVAction(current:AgentAction|null|undefined,text:string):AgentAction|null{
 const turn=parseNVTurn(text,current);
 if(turn.intent==='cancel')return null;
 if(turn.intent==='confirm')return current??null;
 return mergeNVAction(current,turn);
}
