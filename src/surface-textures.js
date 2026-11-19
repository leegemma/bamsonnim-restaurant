// Boundary indices count whole cells from the room's leading edge. The world
// projection places edge 3 at coordinate 2.5 because tile centers are integers.
export function floorSheetBoundaries(size,sheetCells){if(!Number.isInteger(sheetCells)||sheetCells<1)return[];const edges=[];for(let i=sheetCells;i<size;i+=sheetCells)edges.push(i);return edges;}
export function floorSheetSegments(size,sheetCells){return floorSheetBoundaries(size,sheetCells).flatMap(edge=>[{axis:'x',edge,from:{x:edge-.5,y:-.5},to:{x:edge-.5,y:size-.5}},{axis:'y',edge,from:{x:-.5,y:edge-.5},to:{x:size-.5,y:edge-.5}}]);}
