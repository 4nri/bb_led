import {layout,xml,sectionStats} from './model.mjs';
export async function loadAssets(base='./') {
    const [fontResponse,logoResponse]=await Promise.all([fetch(`${base}fonts/ONYTrack-CompressedBlack.otf`),fetch(`${base}assets/bb_logo_for_background.svg`)]);
    if(!fontResponse.ok||!logoResponse.ok)throw new Error('Не удалось загрузить логотип или ONY Track. Проверьте файлы проекта.');
    const buffer=await fontResponse.arrayBuffer();
    const font=opentype.parse(buffer);
    const document=new DOMParser().parseFromString(await logoResponse.text(),'image/svg+xml');
    if(document.querySelector('parsererror'))throw new Error('Не удалось прочитать логотип.');
    const logoPaths=Array.from(document.querySelectorAll('path'),p=>p.getAttribute('d'));
    if(!logoPaths.length)throw new Error('В файле логотипа нет контуров.');
    const face=await new FontFace('ONY Track Compressed Black',buffer).load();
    window.document.fonts.add(face);
    return {fonts:new Map([['ony',font]]),logoPaths};
}
function blockMarkup(block,height,assets,interactive) {
    const y=height/2+block.verticalOffset;
    let geometry;
    if(block.type==='logo') {
        geometry=`<g transform="translate(0 ${y-block.fontSize/2}) scale(${block.fontSize/118})">${assets.logoPaths.map(d=>`<path d="${xml(d)}"/>`).join('')}</g>`;
    } else {
        const font=assets.fonts.get(block.fontKey);
        // Постоянная базовая линия: Д, Щ, Ё и нижние выносные элементы не двигают строку.
        const lineCenter=(font.ascender+font.descender)*block.fontSize/(2*font.unitsPerEm);
        const path=font.getPath(block.text,0,y+lineCenter,block.fontSize).toPathData(2);
        geometry=`<path d="${path}"/>`;
    }
    const interaction=interactive?` data-block-id="${block.id}" class="artwork-block" tabindex="0" role="button" aria-label="${xml(block.type==='logo'?'Логотип BETBOOM':block.text||'Пустой текст')}"`:'';
    const hitarea=interactive?`<rect class="block-hitarea" width="${Math.max(1,block.width)}" height="${height}"/>`:'';
    return `<g${interaction} transform="translate(${block.x} 0)" fill="${block.color}">${hitarea}${geometry}</g>`;
}
export function sectionMarkup(project,assets,{interactive=false}={}) {
    return layout(project,assets.fonts).blocks.map(b=>blockMarkup(b,project.boardHeight,assets,interactive)).join('');
}
export function svgDocument(project,assets,kind='section') {
    const width=kind==='board'?project.totalLength:project.sectionLength;
    const height=project.boardHeight;
    const contents=sectionMarkup(project,assets);
    let artwork=contents;
    if(kind==='board') {
        const {count,remainder}=sectionStats(project);
        const repeats=count+(remainder?1:0);
        if(repeats>10000)throw new Error('Слишком много повторений. Увеличьте длину секции для экспорта всего борта.');
        // Остаток явно заполняется началом следующей секции и кадрируется корнем SVG.
        artwork=`<defs><svg id="section" width="${project.sectionLength}" height="${height}" viewBox="0 0 ${project.sectionLength} ${height}" overflow="hidden">${contents}</svg></defs>`;
        artwork+=Array.from({length:repeats},(_,i)=>`<use href="#section" x="${i*project.sectionLength}"/>`).join('');
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden"><rect width="${width}" height="${height}" fill="${project.bgColor}"/>${artwork}</svg>`;
}
