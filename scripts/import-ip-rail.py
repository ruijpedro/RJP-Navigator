#!/usr/bin/env python3
"""Materializa a camada ferroviária IP a partir da base nacional existente."""
import json
from pathlib import Path
src=Path("public/data/rede-ferroviaria-nacional.json")
dst=Path("public/data/ip/rail.json")
data=json.loads(src.read_text(encoding="utf-8"))
out=[]
for line in data.get("linhas",[]):
    for segment in line.get("segmentos",[]):
        coords=segment.get("coords") or []
        if len(coords)>1:
            out.append({"name":line.get("nome",""),"detail":segment.get("segmento",""),"points":coords})
if len(out)<50:
    raise RuntimeError(f"Rede IP incompleta: {len(out)} segmentos")
dst.parent.mkdir(parents=True,exist_ok=True)
dst.write_text(json.dumps(out,separators=(",",":"),ensure_ascii=False),encoding="utf-8")
print("Rede ferroviária IP:",len(out),"segmentos")
