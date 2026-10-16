/** Cartografia nacional offline compilada dentro da WebApp/APK. */
export function validateNationalNetwork(data,{minimumLines=40,minimumSegments=50}={}){
 const lines=data?.linhas;
 if(!Array.isArray(lines)||lines.length<minimumLines)throw Error('ficheiro cartográfico nacional ausente ou incompleto (linhas)');
 const count=lines.reduce((n,line)=>n+(Array.isArray(line.segmentos)?line.segmentos.filter(s=>Array.isArray(s.coords)&&s.coords.length>=2).length:0),0);
 if(count<minimumSegments)throw Error('ficheiro cartográfico nacional incompleto (geometrias)');
 return data;
}
export async function loadNationalNetwork(url,{fetcher=fetch,signal}={}){
 const response=await fetcher(url,{cache:'no-cache',signal});
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 return validateNationalNetwork(await response.json());
}
