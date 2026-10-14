// Base original preservada do repositório ruijpedro/RJP-Navigator (main, outubro 2026).
// Não atribuir lat/lng sem geometria da linha ou levantamento de campo.
const rows = `
22+890~Telhal~Telhal~Sintra~Almargem do Bispo
24+988~Sabugo~Sabugo~Sintra~Almargem do Bispo
29+881~P. Furadas~P. Furadas~Sintra~Almargem do Bispo
30+906~Mastrontas~Mastrontas~Sintra~Almargem do Bispo
33+467~Mafra Gare~Mafra Gare~Mafra~Igreja Nova
36+227~Malveira~Malveira~Mafra~Igreja Nova
40+826~C. S. Martinho~C. S. Martinho~Mafra~Milharado
41+715~Juromelo~Juromelo~Sobral de Monte Agraço~Sapatatia
43+252~C. Caixeiros~C. Caixeiros~Sobral de Monte Agraço~Sapatatia
45+850~Saparatia~Saparatia~Sobral de Monte Agraço~Sapatatia
47+958~P. Negro~P. Negro~Sobral de Monte Agraço~Sapatatia
49+889~Malgas~Malgas~Sobral de Monte Agraço~Sobral de Monte Agraço
50+514~Zibreira~Zibreira~Sobral de Monte Agraço~Sobral de Monte Agraço
54+810~D. Portos~D. Portos~Torres Vedras~Dois Portos
58+939~Runa~Runa~Torres Vedras~Runa
60+611~Portucheira~Portucheira~Torres Vedras~Matacães
61+844~Macheia~Macheia~Torres Vedras~Matacães
66+116~B. Amiais~B. Amiais~Torres Vedras~S. Pedro e S. Tiago
67+773~Arial Oeste~Arial Oeste~Torres Vedras~Santa Maria
76+798~C. Larana~C. Larana~Torres Vedras~Maxial
77+824~Outeiro Cabeça~Outeiro Cabeça~Torres Vedras~Maxial
81+985~V. Francas~V. Francas~Cadaval~Pero Moniz
90+851~Paul~Paul~Bombarral~Rolica
94+124~S. Mamede~S. Mamede~Bombarral~Rolica
99+723~Obidos~Obidos~Óbidos~Stª Maria de Óbidos
100+912~Obidos~Obidos~Óbidos~S. Pedro de Óbidos
108+405~Campo Sera~Campo Sera~Caldas da Rainha~Tornada
114+816~Salir~Salir~Caldas da Rainha~Salir do Porto
115+641~S. Martinho Porto~S. Martinho Porto~Alcobaça~S. Martinho do Porto
117+243~S. Martinho Porto~S. Martinho Porto~Alcobaça~S. Martinho do Porto
117+664~S. Martinho Porto~S. Martinho Porto~Alcobaça~S. Martinho do Porto
122+032~Famalicão Nazaré~Famalicão Nazaré~Nazaré~Famalição da Nazaré
123+407~PN km 123,407~~Nazaré~Famalição da Nazaré
125+438~Cela~Cela~Alcobaça~Cela
129+244~Bárrio~Bárrio~Alcobaça~Bárrio
129+841~Valado~Valado~Nazaré~Valado
135+792~Fanhais~Fanhais~Nazaré~Nazaré
139+507~PN km 139,507~~Alcobaça~Pataias
146+226~Moita~Moita~Alcobaça~Pataias
150+876~Barosa~Barosa~Marinha Grande~Marinha Grande
151+596~Barosa~Barosa~Marinha Grande~Marinha Grande
155+459~Lixeira~Lixeira~Leiria~Maceira
157+708~Picheleiro~Picheleiro~Leiria~Parceiros
159+028~Moinhos da Barosa~Moinhos da Barosa~Leiria~Parceiros
159+507~Barosa~Barosa~Leiria~Barosa
160+425~PN km 160,425~~Leiria~Marrazes
161+163~PN km 161,163~~Leiria~Marrazes
162+517~PN km 162,517~~Leiria~Marrazes
164+079~Regueira de Pontes~Regueira de Pontes~Leiria~Regueira de Pontes
166+582~Amor~Amor~Leiria~Regueira de Pontes
168+869~PN km 168,869~~Leiria~Monte Raeal
170+418~PN km 170,418~~Leiria~Monte Raeal
174+019~PN km 174,019~~Leiria~Carreira
175+976~PN km 175,976~~Leiria~Monte Redondo
177+173~PN km 177,173~~Leiria~Monte Redondo
178+142~PN km 178,142~~Leiria~Monte Redondo
180+660~PN km 180,660~~Leiria~Monte Redondo
187+853~PN km 187,853~~Pombal~Carriço
189+905~PN km 189,905~~Pombal~Carriço
`.trim().split('\n');
export const passagensNivelLinhaOeste = rows.map((row) => {
  const [pk,nome,localidade,concelho,freguesia] = row.split('~');
  const km = pk.replace('+', ',');
  return { id:`pn-km-${pk.replace('+','-')}`, pk, km, nome, localidade, concelho, freguesia,
    categoria:'Passagem de Nível', linha:'Linha do Oeste', lat:'',lng:'',
    observacoes:'PN da base existente. Coordenadas não verificadas até existir traçado georreferenciado ou GPS de campo.' };
});
