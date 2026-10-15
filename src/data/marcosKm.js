export const marcosKmLinhaOeste = Array.from({length:170},(_,i)=>{
 const km=i+22;return {id:`pk-${km}`,nome:`PK ${km}+000`,pk:`${km}+000`,km:`${km},000`,
 categoria:'Marco Quilométrico',linha:'Linha do Oeste',lat:'',lng:'',observacoes:'Referência quilométrica; posição estimável apenas sobre geometria ferroviária.'};
});
export const marcosPrincipaisLinhaOeste=[{pk:'21+191',nome:'Início responsabilidade'},
{pk:'28+420',nome:'Primeira PN da listagem 2026 — GPS por validar'}, {pk:'25+378',nome:'Sabugo'}, {pk:'157+708',nome:'Picheleiro'},
{pk:'160+425',nome:'Leiria'}, {pk:'191+191',nome:'Fim responsabilidade'}];
