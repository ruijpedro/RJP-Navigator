// Marcos quilométricos aproximados da Linha do Oeste.
// Sem coordenadas reais: usados para pesquisa, referência de PK/Km e registo em campo.
// Para navegação por mapa real, preencher lat/lng quando forem levantados no terreno.

const inicioKm = 22;
const fimKm = 191;

export const marcosKmLinhaOeste = Array.from({ length: fimKm - inicioKm + 1 }, (_, i) => {
  const km = inicioKm + i;
  return {
    id: `pk-${km}`,
    nome: `PK ${km}+000`,
    indice: `PK ${km}+000`,
    km: `${km},000`,
    pk: `${km}+000`,
    tipo: 'Marco quilométrico',
    categoria: 'Marco Quilométrico',
    linha: 'Linha do Oeste',
    lado: '',
    localidade: '',
    concelho: '',
    freguesia: '',
    estado: 'Referência',
    lat: '',
    lng: '',
    observacoes: 'Marco quilométrico de referência. Coordenadas a levantar/confirmar no terreno.'
  };
});

export const marcosPrincipaisLinhaOeste = [
  { pk: '22+890', nome: 'Início zona Telhal / OE 101' },
  { pk: '25+378', nome: 'Sabugo' },
  { pk: '157+708', nome: 'OE 209 / Picheleiro' },
  { pk: '160+425', nome: 'Zona Leiria / OE 210' },
  { pk: '191+197', nome: 'Carriço / fim do troço' }
];
