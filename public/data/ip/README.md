# Cartografia IP no RJP Navigator Auto

Fonte: Infraestruturas de Portugal, S. A., conjuntos de dados *Rede Ferroviária Nacional*, *Rede Rodoviária Nacional* e *Estações e Apeadeiros* disponibilizados em https://dados.gov.pt/pt/datasets/ (licença CC BY 4.0).

A geometria de estações e de estradas foi reaproveitada do repositório público do mesmo projeto, `ruijpedro/RJP_Train-live`. O ficheiro `road.json` foi convertido automaticamente do Shapefile `Rede_Rodoviaria` em EPSG:3763 para WGS84 e simplificado com tolerância métrica de 4 m. São considerados apenas os troços marcados como construídos; não são incluídos os troços em projeto ou construção.

Os ficheiros indicam proximidade geográfica aproximada. **Não** são cadastro de servidões, itinerários legalmente permitidos, GPS de precisão topográfica nem prova de PK oficial. O cálculo de PK necessita de marcos calibrados e verificados, que não constam diretamente do Shapefile.

Recomenda-se usar os dados apenas como apoio técnico preliminar e confirmar no terreno as referências e acessos.
