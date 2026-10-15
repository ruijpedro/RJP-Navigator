// RJP Navigator V3.9 — lista de PN da Linha do Oeste atualizada em 15/10/2026.
// Fonte principal: «PN LO.xlsx» (PK, Type). São 103 PN únicas.
// A base antiga (59 PN) foi usada apenas para conservar nome/localização administrativa
// nos 48 PK que coincidem. As 11 PN antigas ausentes da nova lista NÃO são importadas.
// As 55 PN novas não traziam nome/localidade/GPS na folha de origem.
// A localização de PK fora do troço 21+191–191+191 não é extrapolada.
const rows = `
28+420~~~~
29+876~~~~
30+906~Mastrontas~Mastrontas~Sintra~Almargem do Bispo
34+988~~~~
36+227~Malveira~Malveira~Mafra~Igreja Nova
37+654~~~~
38+425~~~~
41+715~Juromelo~Juromelo~Sobral de Monte Agraço~Sapatatia
45+134~~~~
45+850~Sapataria~Sapataria~Sobral de Monte Agraço~Sapataria
46+973~~~~
47+958~P. Negro~P. Negro~Sobral de Monte Agraço~Sapatatia
49+538~~~~
49+889~Malgas~Malgas~Sobral de Monte Agraço~Sobral de Monte Agraço
50+514~Zibreira~Zibreira~Sobral de Monte Agraço~Sobral de Monte Agraço
52+719~~~~
54+810~D. Portos~D. Portos~Torres Vedras~Dois Portos
56+430~~~~
56+967~~~~
58+939~Runa~Runa~Torres Vedras~Runa
60+611~Portucheira~Portucheira~Torres Vedras~Matacães
61+844~Macheia~Macheia~Torres Vedras~Matacães
64+179~~~~
66+116~B. Amiais~B. Amiais~Torres Vedras~S. Pedro e S. Tiago
68+141~~~~
69+446~~~~
70+524~~~~
79+680~~~~
81+985~V. Francas~V. Francas~Cadaval~Pero Moniz
82+878~~~~
86+496~~~~
87+383~~~~
88+542~~~~
90+851~Paul~Paul~Bombarral~Rolica
94+124~S. Mamede~S. Mamede~Bombarral~Rolica
99+661~~~~
99+832~~~~
106+201~~~~
107+504~~~~
108+405~Campo Sera~Campo Sera~Caldas da Rainha~Tornada
110+629~~~~
112+098~~~~
114+816~Salir~Salir~Caldas da Rainha~Salir do Porto
115+641~S. Martinho Porto~S. Martinho Porto~Alcobaça~S. Martinho do Porto
117+243~S. Martinho Porto~S. Martinho Porto~Alcobaça~S. Martinho do Porto
117+664~S. Martinho Porto~S. Martinho Porto~Alcobaça~S. Martinho do Porto
118+111~~~~
122+032~Famalicão Nazaré~Famalicão Nazaré~Nazaré~Famalição da Nazaré
123+407~PN km 123,407~~Nazaré~Famalição da Nazaré
125+438~Cela~Cela~Alcobaça~Cela
129+244~Bárrio~Bárrio~Alcobaça~Bárrio
129+841~Valado~Valado~Nazaré~Valado
134+465~~~~
135+792~Fanhais~Fanhais~Nazaré~Nazaré
139+507~PN km 139,507~~Alcobaça~Pataias
140+092~~~~
146+226~Moita~Moita~Alcobaça~Pataias
149+830~~~~
150+876~Barosa~Barosa~Marinha Grande~Marinha Grande
151+596~Barosa~Barosa~Marinha Grande~Marinha Grande
153+336~~~~
155+459~Lixeira~Lixeira~Leiria~Maceira
157+708~Picheleiro~Picheleiro~Leiria~Parceiros
159+028~Moinhos da Barosa~Moinhos da Barosa~Leiria~Parceiros
159+507~Barosa~Barosa~Leiria~Barosa
160+425~PN km 160,425~~Leiria~Marrazes
161+163~PN km 161,163~~Leiria~Marrazes
161+786~~~~
162+517~PN km 162,517~~Leiria~Marrazes
164+079~Regueira de Pontes~Regueira de Pontes~Leiria~Regueira de Pontes
165+320~~~~
166+582~Amor~Amor~Leiria~Regueira de Pontes
168+869~PN km 168,869~~Leiria~Monte Raeal
170+418~PN km 170,418~~Leiria~Monte Raeal
174+019~PN km 174,019~~Leiria~Carreira
175+976~PN km 175,976~~Leiria~Monte Redondo
177+173~PN km 177,173~~Leiria~Monte Redondo
178+142~PN km 178,142~~Leiria~Monte Redondo
180+660~PN km 180,660~~Leiria~Monte Redondo
183+012~~~~
185+890~~~~
186+754~~~~
187+853~PN km 187,853~~Pombal~Carriço
189+905~PN km 189,905~~Pombal~Carriço
192+055~~~~
194+768~~~~
196+994~~~~
198+098~~~~
199+539~~~~
200+707~~~~
202+969~~~~
204+652~~~~
206+836~~~~
208+346~~~~
209+213~~~~
210+266~~~~
210+908~~~~
211+404~~~~
212+277~~~~
212+983~~~~
213+233~~~~
213+630~~~~
214+096~~~~
`.trim().split('\n');

export const passagensNivelLinhaOeste = rows.map((row) => {
  const [pk, nomeOriginal, localidade, concelho, freguesia] = row.split('~');
  const metrica = Number(pk.replace('+', ''));
  const nova = !nomeOriginal;
  const nome = nomeOriginal || `PN km ${pk.replace('+', ',')}`;
  const dentroTroco = metrica >= 21191 && metrica <= 191191;
  return {
    id: `pn-km-${pk.replace('+', '-')}`,
    pk,
    km: pk.replace('+', ','),
    nome,
    localidade,
    concelho,
    freguesia,
    categoria: 'Passagem de Nível',
    linha: 'Linha do Oeste',
    tipo: 'PN',
    lat: '', lng: '',
    fonte: 'PN LO.xlsx — 15/10/2026',
    estadoDados: nova ? 'Nova — só PK confirmado na lista' : 'PK coincidente — metadados herdados da base anterior',
    dentroTroco,
    observacoes: dentroTroco
      ? 'PK constante da listagem atualizada; coordenada estimada pelo traçado IP, não certificada. Confirmar GPS no terreno.'
      : 'PN constante da listagem atualizada, fora do troço PK 21+191–191+191: sem estimativa de GPS até calibrar este troço da Linha do Oeste.'
  };
});
