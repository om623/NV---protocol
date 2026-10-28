type VercelRequest={method?:string};type VercelResponse={status:(n:number)=>VercelResponse;json:(b:unknown)=>void;setHeader:(n:string,v:string)=>void};
const FED_HOME='https://www.federalreserve.gov/?PageID=55';
const H15_EFFR='https://www.federalreserve.gov/datadownload/Preview.aspx?pi=400&preview=H15%2FH15%2FRIFSPFF_N.D&rel=H15';
function textOnly(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
 if(req.method&&req.method!=='GET'){res.status(405).json({error:'method_not_allowed'});return;}
 try{
  const [homeHtml,h15Html]=await Promise.all([
   fetch(FED_HOME,{headers:{Accept:'text/html'}}).then(r=>{if(!r.ok)throw new Error('fed_home_'+r.status);return r.text()}),
   fetch(H15_EFFR,{headers:{Accept:'text/html'}}).then(r=>r.ok?r.text():'').catch(()=>''),
  ]);
  const home=textOnly(homeHtml), h15=textOnly(h15Html);
  const range=home.match(/Fed Funds Target Range\s*(\d+(?:\.\d+)?)%\s*(?:to|–|-)\s*(\d+(?:\.\d+)?)%/i);
  const effr=h15.match(/202\d-\d{2}-\d{2}\s+(\d+(?:\.\d+)?)/);
  if(!range) throw new Error('fed_target_range_not_found');
  res.status(200).json({source:'Federal Reserve Board',sourceUrl:FED_HOME,targetLow:Number(range[1]),targetHigh:Number(range[2]),effectiveRate:effr?Number(effr[1]):null,effectiveRateSource:effr?H15_EFFR:null,updatedAt:new Date().toISOString()});
 }catch{res.status(502).json({error:'fed_data_unavailable'});}
}