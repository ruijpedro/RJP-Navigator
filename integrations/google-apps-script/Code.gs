/**
 * RJP Navigator V3.12 — leitura pública e SOMENTE LEITURA da folha PN_LO_Atual.
 * Colar em https://script.google.com/ , implementar como aplicação Web:
 * Executar como: Eu | Quem pode aceder: Qualquer pessoa.
 * A implementação publica APENAS as colunas de PN abaixo. Não acrescentar dados pessoais à folha.
 */
const SHEET_ID = '1_GS7TqQjbb59UJXeVv-woQk2ho7OqkE65JKAFB68VkE';
const TAB_NAME = 'PN_LO_Atual';
const SCHEMA = 'rjp-pn-lo-v1';

function doGet(e) {
  // Callback reduzido a um único identificador seguro. Não aceita código JS arbitrário.
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  if (!/^__rjpPnSync_[0-9]{10,15}_[a-z0-9]{1,15}$/.test(callback)) {
    return ContentService.createTextOutput('/* Nome de callback inválido. */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  let payload;
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    if (!sheet) throw Error('Separador PN_LO_Atual não encontrado');
    const rows = sheet.getDataRange().getDisplayValues();
    if (!rows.length) throw Error('Folha sem cabeçalhos');
    const columns = rows.shift().map(value => String(value).trim().toLowerCase());
    const column = name => columns.indexOf(name.toLowerCase());
    const required = ['pk','designação','localidade','concelho','freguesia'];
    if (required.some(name => column(name) < 0)) throw Error('Cabeçalhos PN_LO_Atual inesperados');
    const val = (row, name) => {
      const i=column(name);return i>=0 ? String(row[i] || '').trim() : '';
    };
    const active = rows.filter(row => String(row[column('pk')] || '').trim());
    const parsed = active.map(row => ({
      pk:val(row,'PK'),
      nome:val(row,'Designação'),
      localidade:val(row,'Localidade'),
      concelho:val(row,'Concelho'),
      freguesia:val(row,'Freguesia'),
      lat:val(row,'Latitude'),
      lng:val(row,'Longitude'),
      observacoes:val(row,'Observações')
    }));
    // Nunca devolver dados pessoais de outras colunas, mesmo que existam na folha.
    payload = {schema:SCHEMA,rows:parsed,generatedAt:new Date().toISOString()};
  } catch (err) {
    payload={schema:SCHEMA,error:String(err && err.message || err),rows:null};
  }
  // JSON.stringify impede que o conteúdo dos nomes das PN se torne JavaScript executável.
  const js = `${callback}(${JSON.stringify(payload).replace(/</g,'\\u003c')});`;
  return ContentService.createTextOutput(js).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
