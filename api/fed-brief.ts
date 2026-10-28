type VercelRequest={method?:string};type VercelResponse={status:(n:number)=>VercelResponse;json:(b:unknown)=>void;setHeader:(n:string,v:string)=>void};
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 if(req.method&&req.method!=='GET'){res.status(405).json({error:'method_not_allowed'});return;}
 try{
  const html=await fetch('https://www.federalreserve.gov/').then(r=>{if(!r.ok)throw new Error('fed');return r.text()});
  const clean=html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
  const range=clean.match(/Fed Funds Target Range.{0,250}?(\d+(?:\.\d+)?)%\s*(?:to|–|-)\s*(\d+(?:\.\d+)?)%/i);
  res.status(200).json({source:'Federal Reserve',targetLow:range?Number(range[1]):null,targetHigh:range?Number(range[2]):null,updatedAt:new Date().toISOString()});
 }catch{res.status(502).json({error:'fed_data_unavailable'});}
}