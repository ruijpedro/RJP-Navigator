#!/usr/bin/env python3
"""Importa apenas rodovias construídas da fonte IP já guardada em RJP_Train-live.
Entrada: Shapefile EPSG:3763. Saída: WGS84, geometrias simplificadas <=4 m.
O output serve de referência aproximada, não de coordenadas legais de projeto.
"""
import json
import math
import pathlib
import urllib.request

import shapefile
from pyproj import Transformer

BASE = "https://raw.githubusercontent.com/ruijpedro/RJP_Train-live/main/public/data/Rede_Rodoviaria."
TMP = pathlib.Path(".ip-import")
OUT = pathlib.Path("public/data/ip/road.json")

def simplify(coords, tolerance=4.0):
    """Douglas–Peucker no sistema métrico original, sem eliminar extremos."""
    if len(coords) < 3:
        return list(coords)
    sq=tolerance*tolerance
    keep={0,len(coords)-1}
    stack=[(0,len(coords)-1)]
    while stack:
        lo,hi=stack.pop()
        ax,ay=coords[lo]
        bx,by=coords[hi]
        dx=bx-ax
        dy=by-ay
        den=dx*dx+dy*dy
        best_dist=0.0
        best_index=None
        for i in range(lo+1,hi):
            px,py=coords[i]
            t=max(0.0,min(1.0,((px-ax)*dx+(py-ay)*dy)/den)) if den else 0.0
            d=(px-ax-t*dx)**2+(py-ay-t*dy)**2
            if d>best_dist:
                best_dist=d
                best_index=i
        if best_index is not None and best_dist>sq:
            keep.add(best_index)
            stack.append((lo,best_index))
            stack.append((best_index,hi))
    return [coords[i] for i in sorted(keep)]

def main():
    TMP.mkdir(exist_ok=True)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    for ext in ("shp","shx","dbf","cpg"):
        dest=TMP/("Rede_Rodoviaria."+ext)
        print("A obter",ext,flush=True)
        urllib.request.urlretrieve(BASE+ext,str(dest))
        if dest.stat().st_size<5:
            raise RuntimeError("Shapefile incompleto: "+ext)
    reader=shapefile.Reader(str(TMP/"Rede_Rodoviaria.shp"),encoding="utf-8")
    transform=Transformer.from_crs(3763,4326,always_xy=True)
    total=0
    with OUT.open("w",encoding="utf-8") as f:
        f.write("[")
        first=True
        for obj in reader.iterShapeRecords():
            attrs=obj.record.as_dict()
            if attrs.get("estado","").strip().casefold()!="construído":
                continue
            orig=obj.shape.points
            parts=list(obj.shape.parts)+[len(orig)]
            for j in range(len(parts)-1):
                pts=orig[parts[j]:parts[j+1]]
                if len(pts)<2:continue
                reduced=simplify(pts)
                wgs=[]
                for x,y in reduced:
                    lon,lat=transform.transform(x,y)
                    if math.isfinite(lon) and math.isfinite(lat) and 35<lat<44 and -11<lon<-5:
                        wgs.append([round(lat,6),round(lon,6)])
                if len(wgs)<2:continue
                n=attrs.get("roadnumber","").strip()
                road1=attrs.get("road1","").strip()
                name=n if n else (road1 or "Estrada sem número")
                item={"name":name,"detail":attrs.get("distrito","").strip(),
                      "category":attrs.get("categoria","").strip(),"route":road1,
                      "points":wgs,"bbox":[min(p[0] for p in wgs),min(p[1] for p in wgs),
                                         max(p[0] for p in wgs),max(p[1] for p in wgs)]}
                if not first:f.write(",")
                f.write(json.dumps(item,ensure_ascii=False,separators=(",",":")))
                first=False
                total+=1
        f.write("]")
    mb=OUT.stat().st_size/1048576
    print("Rodovia IP:",total,"segmentos construídos;",round(mb,2),"MiB")
    if total<25000 or mb>35:
        raise RuntimeError("Contagem/tamanho de saída anormal; dados não validados")

if __name__=="__main__":
    main()
