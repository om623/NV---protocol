// NV Agent semantic interpreter. Server-side only: never expose OPENAI_API_KEY.
type VercelRequest={method?:string;body?:unknown}; type VercelResponse={status:(n:number)=>VercelResponse;json:(b:unknown)=>void;setHeader:(n:string,v:string)=>void};
const INTENTS=['market_price','market_top','market_movers','market_status','capabilities','greeting','thanks','news','tvl_chain','tvl_top','wallet_evm','wallet_solana','payment_info','bridge_info','action_transfer','action_bridge','action_swap','action_payment','mode_assisted','mode_authorized','unknown'] as const;
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store'); if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return;}
 const b=(req.body&&typeof req.body==='object'?req.body:{}) as {message?:unknown;history?:unknown};
 const message=typeof b.message==='string'?b.message.trim():''; const history=Array.isArray(b.history)?b.history.slice(-10):[];
 if(!message||message.length>4000){res.status(400).json({error:'invalid_request'});return;}
 const key=process.env.OPENAI_API_KEY; if(!key){res.status(503).json({error:'semantic_not_configured'});return;}
 try{
  const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({
   model:process.env.NV_AGENT_MODEL||'gpt-5.1',
   instructions:'You are the semantic interpretation layer of NV Agent, a non-custodial multichain finance interface. Infer the user intent from the current message plus recent conversation. Never invent balances, prices, routes, permissions or transaction success. Never execute anything. Return ONLY one compact JSON object. For financial actions extract explicit parameters only. If a value is missing use null. Distinguish swap (same-chain token exchange), bridge (cross-chain), transfer (send to recipient), and NV internal purchase. Resolve follow-ups such as "e Ethereum?", "faça o mesmo com 10", or an address supplied after a prior transfer using history. CRITICAL: when the previous assistant turn asked for missing transaction fields, treat the next short message as slot filling for that SAME action even if it omits the action verb. Example: after a Swap asks for value/source/destination, "valor: 0.001 de USDC para EURC" must remain action_swap with amount=0.001, sourceToken=USDC, destinationToken=EURC, not market_price. intent must be one of: '+INTENTS.join(', ')+'. JSON keys: intent, rewritten, amount, token, sourceToken, destinationToken, recipient, fromNetwork, toNetwork, product, needsClarification, clarification. rewritten should be a concise standalone user request preserving exact addresses/numbers.',
   input:[...history.map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content??'').slice(0,2000)})),{role:'user',content:message}],
   text:{format:{type:'json_schema',name:'nv_agent_intent',strict:true,schema:{type:'object',additionalProperties:false,properties:{
    intent:{type:'string',enum:INTENTS},rewritten:{type:'string'},amount:{type:['number','null']},token:{type:['string','null']},sourceToken:{type:['string','null']},destinationToken:{type:['string','null']},recipient:{type:['string','null']},fromNetwork:{type:['string','null']},toNetwork:{type:['string','null']},product:{type:['string','null']},needsClarification:{type:'boolean'},clarification:{type:['string','null']}
   },required:['intent','rewritten','amount','token','sourceToken','destinationToken','recipient','fromNetwork','toNetwork','product','needsClarification','clarification']}}}
  })});
  if(!upstream.ok){res.status(502).json({error:'semantic_provider_failed'});return;}
  const data=await upstream.json() as any; const raw=data.output_text??data.output?.flatMap((x:any)=>x.content??[]).find((x:any)=>x.type==='output_text')?.text;
  if(!raw){res.status(502).json({error:'empty_semantic_response'});return;} res.status(200).json(JSON.parse(raw));
 }catch{res.status(502).json({error:'semantic_unavailable'});}
}