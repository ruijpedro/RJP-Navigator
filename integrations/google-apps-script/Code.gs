/**
 * RJP Navigator V4.0 — endpoint SOMENTE LEITURA do inventário RFN.
 * Fonte: Google Sheets "RJP Navigator - Ativos Ferroviários", separador "Ativos".
 * IMPLEMENTAR: Executar como "Eu"; acesso "Qualquer pessoa" (apenas dados operacionais não confidenciais).
 * AVISO: o endpoint publica os campos abaixo a qualquer pessoa que saiba o URL. Não introduzir dados pessoais/sensíveis na folha.
 * Após alterações neste Code.gs, criar uma nova VERSÃO da implementação (não apenas guardar código).
 */
const SPREADSHEET_ID='1JBRHtWuFx-wMsCGimf28LhVVOjrL5mIX5Z_NGiJa0Dw';
const SHEET_NAME='Ativos';
const FEED_SCHEMA='rjp-ativos-rfn-v1';
function doGet(e){
 const callback=String(e?.parameter?.callback||'');
 // O cliente V4 reutiliza o callback de transporte JSONP já existente.
 if(!/^__rjpPnSync_[0-9]{10,15}_[a-z0-9]{1,15}$/.test(callback)){
  return ContentService.createTextOutput('/* callback inválido */').setMimeType(ContentService.MimeType.JAVASCRIPT);
 }
 let payload;
 try{
  const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if(!sheet)throw Error('Separador Ativos não encontrado.');
  const values=sheet.getDataRange().getDisplayValues();
  if(values.length<2)throw Error('Tabela de ativos sem dados.');
  const columns=values.shift().map(s=>String(s).trim().toLowerCase());
  const find=n=>columns.indexOf(n.toLowerCase());
  const required=['ID','Linha','Tipo','PK','Designação'];
  if(required.some(n=>find(n)<0))throw Error('Cabeçalhos da tabela incorretos.');
  const val=(row,n)=>{const i=find(n);return i>=0?String(row[i]||'').trim():'';};
  const records=values.filter(row=>val(row,'ID')&&val(row,'Linha')).map(row=>({
   id:val(row,'ID'),linha:val(row,'Linha'),tipo:val(row,'Tipo'),pk:val(row,'PK'),
   nome:val(row,'Designação'),localidade:val(row,'Localidade'),concelho:val(row,'Concelho'),
   freguesia:val(row,'Freguesia'),lat:val(row,'Latitude'),lng:val(row,'Longitude'),
   estado:val(row,'Estado'),observacoes:val(row,'Observações'),fonte:val(row,'Fonte'),
   atualizadoEm:val(row,'AtualizadoEm')
  }));
  payload={schema:FEED_SCHEMA,rows:records,generatedAt:new Date().toISOString()};
 }catch(err){payload={schema:FEED_SCHEMA,error:String(err?.message||err),rows:null};}
 return ContentService.createTextOutput(callback+'('+JSON.stringify(payload).replace(/</g,'\\u003c')+');')
  .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
