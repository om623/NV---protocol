// NV Agent — finance-first conversational brain.
// Server-side only. Uses the OpenAI Responses API and never exposes credentials.
type Req={method?:string;body?:unknown}; type Res={status:(n:number)=>Res;json:(b:unknown)=>void;setHeader:(n:string,v:string)=>void};
function compactContext(raw:any){
 const assets=(raw?.market?.assets??[]).slice(0,120).map((a:any)=>({symbol:a.symbol,name:a.name,category:a.category,price:a.price,change24h:a.change24h,change7d:a.change7d,marketCap:a.marketCap,volume24h:a.volume24h,isLive:a.isLive}));
 const tvl=(raw?.tvl?.entries??[]).slice(0,60).map((e:any)=>({id:e.id,name:e.displayName,tvlUsd:e.tvlUsd,status:e.status}));
 const news=(raw?.news?.items??[]).slice(0,30).map((n:any)=>({title:n.title,summary:n.summary,source:n.source,publishedAt:n.publishedAt,url:n.url,category:n.category,country:n.country,priority:n.priority}));
 return {locale:raw?.locale,market:{isLive:raw?.market?.isLive,fetchedAt:raw?.market?.fetchedAt,sentiment:raw?.market?.sentiment,assets},tvl:{status:raw?.tvl?.status,fetchedAt:raw?.tvl?.fetchedAt,entries:tvl},wallet:{evm:raw?.evmWallet,solana:raw?.solanaWallet},payment:raw?.payment,bridge:raw?.bridge,news};
}
export default async function handler(req:Req,res:Res){
 res.setHeader('Cache-Control','no-store'); if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return;}
 const b=(req.body&&typeof req.body==='object'?req.body:{}) as {message?:unknown;history?:unknown;context?:unknown;locale?:unknown};
 const message=typeof b.message==='string'?b.message.trim():''; if(!message||message.length>6000){res.status(400).json({error:'invalid_request'});return;}
 const key=process.env.OPENAI_API_KEY; if(!key){res.status(503).json({error:'agent_not_configured'});return;}
 const history=Array.isArray(b.history)?b.history.slice(-16).map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content??'').slice(0,3500)})):[];
 const context=compactContext(b.context);
 const instructions=`You are NV Agent, the conversational financial intelligence copilot inside Next Vault Protocol (NV), a non-custodial multichain DeFi interface.
Your goal is to feel like a capable general conversational assistant specialized in finance, markets, crypto, DeFi, investing concepts, macroeconomics, risk, portfolio reasoning, blockchain and the NV product.

BEHAVIOR
- Understand natural, incomplete, colloquial and contextual language. Use conversation history.
- Answer the user's actual question directly; do not force them into menus or keyword commands.
- You may explain, compare, calculate conceptually, teach, brainstorm, summarize, reason about scenarios, and suggest relevant follow-up analysis.
- You can discuss topics outside finance when needed for a coherent conversation, but keep NV's expertise finance-first.
- Never pretend to know live facts that are absent. Prefer the supplied NV live context. When fresh external information is needed, use web search.
- Clearly distinguish facts/data from interpretation. Never promise returns or present speculation as certainty.
- Do not give individualized regulated financial advice as a certainty; provide decision-support, risks, assumptions and alternatives.
- Never claim a transaction executed unless the NV transaction executor reports it. Never ask for seed phrases or private keys.
- If the user asks to transfer, swap, bridge, or buy an NV product, do NOT simulate execution here. Briefly acknowledge the request; the deterministic transaction layer handles execution separately.
- Respect the user's language. Default to the locale in context.
- Be concise by default but expand when the question requires depth.
- NV architecture: the Agent is the single AI inside Intelligence. Dashboard presenter is separate. Swap, Bridge, wallets, market data, TVL, news, payments, reports/history and gamification are NV capabilities.
- Do not invent unavailable NV capabilities.

CURRENT NV CONTEXT (read-only, may contain live data):
${JSON.stringify(context)}`;
 try{
  const body:any={model:process.env.NV_AGENT_MODEL||'gpt-5.1',instructions,input:[...history,{role:'user',content:message}]};
  if(process.env.NV_AGENT_WEB_SEARCH!=='off') body.tools=[{type:'web_search',search_context_size:'medium'}];
  const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!upstream.ok){const detail=await upstream.text(); console.error('[NV Agent] provider',upstream.status,detail.slice(0,500));res.status(502).json({error:'agent_provider_failed'});return;}
  const data=await upstream.json() as any;
  const answer=(data.output_text??data.output?.flatMap((x:any)=>x.content??[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('\n')??'').trim();
  if(!answer){res.status(502).json({error:'empty_agent_response'});return;}
  const sources:any[]=[]; for(const item of data.output??[]){for(const part of item.content??[]){for(const a of part.annotations??[]){const u=a.url??a.url_citation?.url; const title=a.title??a.url_citation?.title??u;if(u&&!sources.some(s=>s.url===u))sources.push({title,url:u,source:'web',publishedAt:''});}}}
  res.status(200).json({answer,sources:sources.slice(0,8)});
 }catch(e){console.error('[NV Agent] unavailable',e);res.status(502).json({error:'agent_unavailable'});}
}