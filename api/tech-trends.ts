type VercelRequest={method?:string};type VercelResponse={status:(n:number)=>VercelResponse;json:(b:unknown)=>void;setHeader:(n:string,v:string)=>void};
type HNItem={id:number;title?:string;url?:string;score?:number;descendants?:number;time?:number;by?:string;type?:string};
const KEYWORDS=/\b(ai|artificial intelligence|agent|llm|model|openai|anthropic|gemini|robot|robotics|chip|gpu|nvidia|quantum|blockchain|crypto|ethereum|bitcoin|web3|defi|cloud|database|security|cyber|browser|linux|open source|github|programming|developer|software|hardware|startup|api)\b/i;
function domainOf(url:string){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return'news.ycombinator.com'}}
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');
 if(req.method&&req.method!=='GET'){res.status(405).json({error:'method_not_allowed'});return;}
 try{
  const ids=await fetch('https://hacker-news.firebaseio.com/v0/topstories.json').then(r=>{if(!r.ok)throw new Error('hn_top');return r.json()}) as number[];
  const items=(await Promise.all(ids.slice(0,45).map(id=>fetch('https://hacker-news.firebaseio.com/v0/item/'+id+'.json').then(r=>r.ok?r.json():null).catch(()=>null)))) as (HNItem|null)[];
  const stories=items.filter((x):x is HNItem=>!!x&&x.type==='story'&&!!x.title).filter(x=>KEYWORDS.test(x.title||''));
  const ranked=(stories.length>=5?stories:items.filter((x):x is HNItem=>!!x&&x.type==='story'&&!!x.title))
   .sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,6).map(x=>{
    const url=x.url||('https://news.ycombinator.com/item?id='+x.id);const domain=domainOf(url);
    return{id:String(x.id),title:x.title,url,domain,score:x.score||0,comments:x.descendants||0,publishedAt:new Date((x.time||0)*1000).toISOString(),image:'https://www.google.com/s2/favicons?domain='+encodeURIComponent(domain)+'&sz=128'};
   });
  res.status(200).json({source:'Hacker News',updatedAt:new Date().toISOString(),refreshSeconds:60,items:ranked});
 }catch{res.status(502).json({error:'tech_trends_unavailable'});}
}