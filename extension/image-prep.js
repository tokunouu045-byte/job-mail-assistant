// Keep overlapping strips so a line at the cut is still visible in the next strip.
export async function prepareImage(input){
 let blob=input;
 if(typeof input==='string'){
  const match=/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec(input);
  if(!match)throw new Error('图片格式不支持，请选择本地图片。');
  blob=new Blob([Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))],{type:match[1]});
 }
 const bitmap=await createImageBitmap(blob);
 try{
  const scale=Math.min(2,1600/bitmap.width),width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale);
  if(!width||!height||height>24000)throw new Error('图片过长，请分成几张再识别。');
  const strips=[];const step=1700,stripHeight=1800;
  for(let y=0;y<height;y+=step){
   const h=Math.min(stripHeight,height-y);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=h;
   const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,width,h);ctx.drawImage(bitmap,0,y/scale,bitmap.width,h/scale,0,0,width,h);
   strips.push(canvas.toDataURL('image/png'));
   if(y+h>=height)break;
  }
  return strips;
 }finally{bitmap.close()}
}
export function joinOCR(parts){
 let lines=[];
 for(const part of parts){const next=part.split('\n').map(x=>x.trim()).filter(Boolean);let overlap=0;
  for(let n=1;n<=Math.min(6,lines.length,next.length);n++)if(lines.slice(-n).join('')===next.slice(0,n).join(''))overlap=n;
  lines.push(...next.slice(overlap));
 }
 return lines.join('\n');
}
