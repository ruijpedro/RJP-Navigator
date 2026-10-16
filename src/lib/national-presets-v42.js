/**
 * Referências quilométricas documentais, não topograficamente certificadas.
 * Os extremos de geometria são aproximados; validação por âncoras e distância
 * ao eixo é obrigatória antes de mostrar qualquer PK calculado.
 */
export const NATIONAL_PRESETS={
 'Linha do Norte|0':{anchors:[{pk:'0+000',position:'start',source:'IP: origem em Santa Apolónia'},{pk:'336+079',position:'end',source:'IP: extremo em Campanhã, por validar nesta geometria'}]},
 'Linha do Minho|0':{anchors:[{pk:'0+000',position:'start',source:'IP: Campanhã'},{pk:'131+449',position:'end',source:'IP: Valença, referência documental'}]},
 'Linha do Minho|1':{anchors:[{pk:'2+618',position:'start',source:'IP: São Bento'},{pk:'0+000',position:'end',source:'IP: Campanhã'}]},
 'Linha de Cascais|0':{anchors:[{pk:'0+000',position:'start',source:'IP: origem do troço'},{pk:'25+400',position:'end',source:'IP: final aproximado'}]},
 'Linha de Cintura|1':{anchors:[{pk:'0+000',position:'start',source:'IP: Alcântara-Terra'},{pk:'10+500',position:'end',source:'IP: Braço de Prata, valor aproximado'}]},
 'Linha do Oeste|0':{anchors:[{pk:'21+191',lat:38.79752688033888,lng:-9.313184100692187,source:'Extremo fornecido pelo utilizador, CRS por validar'},{pk:'191+191',lat:40.00997619214555,lng:-8.813148027613115,source:'Extremo fornecido pelo utilizador, CRS por validar'}]}
};
