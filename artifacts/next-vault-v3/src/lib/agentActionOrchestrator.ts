import type { AgentAction } from './intelligence';

export type ActionParams = Record<string, string | number | null | undefined>;

const TOKENS = ['USDC','EURC','ETH','SOL','POL','MATIC','AVAX'];
const NETWORK_ALIASES: Array<[string,string]> = [
  ['arbitrum sepolia','arbitrum-sepolia'],['optimism sepolia','optimism-sepolia'],['ethereum sepolia','sepolia'],
  ['base sepolia','base-sepolia'],['arc testnet','arc-testnet'],['arc mainnet','arc-mainnet'],
  ['arbitrum','arbitrum'],['optimism','optimism'],['ethereum','ethereum'],['polygon','polygon'],
  ['avalanche','avalanche'],['base','base'],['arc','arc-mainnet'],
];

export function actionComplete(action: AgentAction): boolean {
  const p=action.params??{};
  if(action.type==='swap') return Number(p.amount)>0 && !!p.sourceToken && !!p.destinationToken && p.sourceToken!==p.destinationToken;
  if(action.type==='bridge') return Number(p.amount)>0 && !!p.fromNetwork && !!p.toNetwork && p.fromNetwork!==p.toNetwork;
  if(action.type==='transfer') return Number(p.amount)>0 && !!p.token && typeof p.recipient==='string' && /^0x[0-9a-fA-F]{40}$/.test(p.recipient);
  if(action.type==='payment') return !!p.product;
  return false;
}

export function missingActionFields(action: AgentAction): string[] {
  const p=action.params??{}; const missing:string[]=[];
  if(action.type==='swap'){if(!(Number(p.amount)>0))missing.push('valor');if(!p.sourceToken)missing.push('token de origem');if(!p.destinationToken)missing.push('token de destino');}
  if(action.type==='bridge'){if(!(Number(p.amount)>0))missing.push('valor');if(!p.fromNetwork)missing.push('rede de origem');if(!p.toNetwork)missing.push('rede de destino');}
  if(action.type==='transfer'){if(!(Number(p.amount)>0))missing.push('valor');if(!p.token)missing.push('token');if(!p.recipient)missing.push('destinatário');}
  if(action.type==='payment'&&!p.product)missing.push('produto');
  return missing;
}

export function patchPendingAction(action: AgentAction, text: string, semantic?: ActionParams|null): AgentAction {
  const q=text.trim(); const lower=q.toLowerCase(); const patch:ActionParams={};
  if(semantic) for(const [k,v] of Object.entries(semantic)) if(v!==null&&v!==undefined&&v!=='') patch[k]=v;
  const amount=q.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/); if(amount){const n=Number(amount[1].replace(',','.'));if(n>0)patch.amount=n;}
  const address=q.match(/0x[0-9a-fA-F]{40}/); if(address)patch.recipient=address[0];
  const tokenHits=TOKENS.flatMap(t=>{const m=new RegExp('\\b'+t+'\\b','i').exec(q);return m?[{token:t==='MATIC'?'POL':t,index:m.index}]:[]}).sort((a,b)=>a.index-b.index);
  if(action.type==='swap'){if(tokenHits[0])patch.sourceToken=tokenHits[0].token;if(tokenHits[1])patch.destinationToken=tokenHits[1].token;}
  else if(action.type==='transfer'&&tokenHits[0]) patch.token=tokenHits[0].token;
  const nets: Array<{id:string,index:number}> = []; let work=lower;
  for(const [name,id] of NETWORK_ALIASES){const index=work.indexOf(name);if(index>=0){nets.push({id,index});work=work.slice(0,index)+' '.repeat(name.length)+work.slice(index+name.length);}}
  nets.sort((a,b)=>a.index-b.index);
  if(action.type==='bridge'){if(nets[0])patch.fromNetwork=nets[0].id;if(nets[1])patch.toNetwork=nets[1].id;}
  if(action.type==='payment'){if(/1000/.test(lower))patch.product='premium-1000';else if(/500/.test(lower))patch.product='premium-500';else if(/trimestral|quarterly|300 xp/.test(lower))patch.product='xp-quarterly';else if(/semanal|weekly|60 xp/.test(lower))patch.product='xp-weekly';else if(/di[aá]rio|daily|30 xp/.test(lower))patch.product='xp-daily';}
  return {...action,params:{...(action.params??{}),...patch}};
}

export function isCancelCommand(text:string){return /^(cancel(e|ar)?|desistir|pare|parar|stop|never mind|deixa pra l[aá])\b/i.test(text.trim());}
export function isExecuteCommand(text:string){return /^(confirm(e|ar)?|execute|executar|fa[cç]a|pode executar|pode fazer|prosseguir|prossiga|enviar|envie|sim|yes|go)\b/i.test(text.trim());}

export function actionSummary(action:AgentAction):string{
 const p=action.params??{};
 if(action.type==='swap')return `Swap: ${p.amount??'?'} ${p.sourceToken??'?'} → ${p.destinationToken??'?'}.`;
 if(action.type==='bridge')return `Bridge: ${p.amount??'?'} USDC · ${p.fromNetwork??'?'} → ${p.toNetwork??'?'}.`;
 if(action.type==='transfer')return `Transferência: ${p.amount??'?'} ${p.token??'?'} → ${p.recipient??'?'}.`;
 return `Pagamento: ${p.product??'?'}.`;
}
