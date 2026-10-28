const MIN_SCALE=0.00001;
const MAX_SCALE=8;
export function wheelScale(current,delta,mode=0,viewportHeight=800) {
    const pixels=delta*(mode===1?16:mode===2?viewportHeight:1);
    return Math.min(MAX_SCALE,Math.max(MIN_SCALE,current*Math.exp(-Math.max(-500,Math.min(500,pixels))*0.0015)));
}
