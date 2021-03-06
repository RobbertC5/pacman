//////////////////////////////////////////////////////////////////////////////////////
// Map
// (an ascii map of tiles representing a level maze)

// size of a square tile in pixels
var tileSize = 8;

// the center pixel of a tile
var midTile = {x:3, y:4};

// constructor
var Map = function(numCols, numRows, tiles) {

    // sizes
    this.numCols = numCols;
    this.numRows = numRows;
    this.numTiles = numCols*numRows;
    this.widthPixels = numCols*tileSize;
    this.heightPixels = numRows*tileSize;

    // ascii map
    this.tiles = tiles;

    // ghost home location
    this.doorTile = {x:13, y:14};
    this.doorPixel = {
        x:(this.doorTile.x+1)*tileSize-1, 
        y:this.doorTile.y*tileSize + midTile.y
    };
    this.homeTopPixel = 17*tileSize;
    this.homeBottomPixel = 18*tileSize;

    // pacman and ghosts
    this.pacman = null;
    this.ghosts = [];

    this.timeEaten = {};

    this.resetCurrent();
    this.parseDots();
    this.parseTunnels();
    this.parseWalls();
    this.createHeatMap();
};

Map.prototype.save = function(t) {
};

Map.prototype.eraseFuture = function(t) {
    // current state at t.
    // erase all states after t.
    var i;
    for (i=0; i<this.numTiles; i++) {
        if (t <= this.timeEaten[i]) {
            delete this.timeEaten[i];
        }
    }
};

Map.prototype.load = function(t,abs_t) {
    var firstTile,curTile;
    var refresh = function(i) {
        var x,y;
        x = i%this.numCols;
        y = Math.floor(i/this.numCols);
        renderer.refreshPellet(x,y);
    };
    var i;
    for (i=0; i<this.numTiles; i++) {
        firstTile = this.startTiles[i];
        if (firstTile == '.' || firstTile == 'o') {
            if (abs_t <= this.timeEaten[i]) { // dot should be present
                if (this.currentTiles[i] != firstTile) {
                    this.dotsEaten--;
                    this.currentTiles[i] = firstTile;
                    refresh.call(this,i);
                }
            }
            else if (abs_t > this.timeEaten[i]) { // dot should be missing
                if (this.currentTiles[i] != ' ') {
                    this.dotsEaten++;
                    this.currentTiles[i] = ' ';
                    refresh.call(this,i);
                }
            }
        }
    }
};

Map.prototype.resetTimeEaten = function()
{
    this.startTiles = this.currentTiles.slice(0);
    this.timeEaten = {};
};

// reset current tiles
Map.prototype.resetCurrent = function() {
    this.currentTiles = this.tiles.split(""); // create a mutable list copy of an immutable string
    this.dotsEaten = 0;
};

// This is a procedural way to generate original-looking maps from a simple ascii tile
// map without a spritesheet.
Map.prototype.parseWalls = function() {

    var that = this;

    // creates a list of drawable canvas paths to render the map walls
    this.paths = [];

    // a map of wall tiles that already belong to a built path
    var visited = {};

    // we extend the x range to suggest the continuation of the tunnels
    var toIndex = function(x,y) {
        if (x>=-2 && x<that.numCols+2 && y>=0 && y<that.numRows)
            return (x+2)+y*(that.numCols+4);
    };

    // a map of which wall tiles that are not completely surrounded by other wall tiles
    var edges = {};
    var i=0,x,y;
    for (y=0;y<this.numRows;y++) {
        for (x=-2;x<this.numCols+2;x++,i++) {
            if (this.getTile(x,y) == '|' &&
                (this.getTile(x-1,y) != '|' ||
                this.getTile(x+1,y) != '|' ||
                this.getTile(x,y-1) != '|' ||
                this.getTile(x,y+1) != '|' ||
                this.getTile(x-1,y-1) != '|' ||
                this.getTile(x-1,y+1) != '|' ||
                this.getTile(x+1,y-1) != '|' ||
                this.getTile(x+1,y+1) != '|')) {
                edges[i] = true;
            }
        }
    }

    // walks along edge wall tiles starting at the given index to build a canvas path
    var makePath = function(tx,ty) {

        // get initial direction
        var dir = {};
        var dirEnum;
        if (toIndex(tx+1,ty) in edges)
            dirEnum = DIR_RIGHT;
        else if (toIndex(tx, ty+1) in edges)
            dirEnum = DIR_DOWN;
        else
            throw "tile shouldn't be 1x1 at "+tx+","+ty;
        setDirFromEnum(dir,dirEnum);

        // increment to next tile
        tx += dir.x;
        ty += dir.y;

        // backup initial location and direction
        var init_tx = tx;
        var init_ty = ty;
        var init_dirEnum = dirEnum;

        var path = [];
        var pad; // (persists for each call to getStartPoint)
        var point;
        var lastPoint;

        var turn,turnAround;

        /*

           We employ the 'right-hand rule' by keeping our right hand in contact
           with the wall to outline an individual wall piece.

           Since we parse the tiles in row major order, we will always start
           walking along the wall at the leftmost tile of its topmost row.  We
           then proceed walking to the right.  

           When facing the direction of the walk at each tile, the outline will
           hug the left side of the tile unless there is a walkable tile to the
           left.  In that case, there will be a padding distance applied.
           
        */
        var getStartPoint = function(tx,ty,dirEnum) {
            var dir = {};
            setDirFromEnum(dir, dirEnum);
            if (!(toIndex(tx+dir.y,ty-dir.x) in edges))
                pad = that.isFloorTile(tx+dir.y,ty-dir.x) ? 5 : 0;
            var px = -tileSize/2+pad;
            var py = tileSize/2;
            var a = getClockwiseAngleFromTop(dirEnum);
            var c = Math.cos(a);
            var s = Math.sin(a);
            return {
                // the first expression is the rotated point centered at origin
                // the second expression is to translate it to the tile
                x:(px*c - py*s) + (tx+0.5)*tileSize,
                y:(px*s + py*c) + (ty+0.5)*tileSize,
            };
        };
        while (true) {
            
            visited[toIndex(tx,ty)] = true;

            // determine start point
            point = getStartPoint(tx,ty,dirEnum);

            if (turn) {
                // if we're turning into this tile, create a control point for the curve
                //
                // >---+  <- control point
                //     |
                //     V
                lastPoint = path[path.length-1];
                if (dir.x == 0) {
                    point.cx = point.x;
                    point.cy = lastPoint.y;
                }
                else {
                    point.cx = lastPoint.x;
                    point.cy = point.y;
                }
            }

            // update direction
            turn = false;
            turnAround = false;
            if (toIndex(tx+dir.y, ty-dir.x) in edges) { // turn left
                dirEnum = rotateLeft(dirEnum);
                turn = true;
            }
            else if (toIndex(tx+dir.x, ty+dir.y) in edges) { // continue straight
            }
            else if (toIndex(tx-dir.y, ty+dir.x) in edges) { // turn right
                dirEnum = rotateRight(dirEnum);
                turn = true;
            }
            else { // turn around
                dirEnum = rotateAboutFace(dirEnum);
                turnAround = true;
            }
            setDirFromEnum(dir,dirEnum);

            // commit path point
            path.push(point);

            // special case for turning around (have to connect more dots manually)
            if (turnAround) {
                path.push(getStartPoint(tx-dir.x, ty-dir.y, rotateAboutFace(dirEnum)));
                path.push(getStartPoint(tx, ty, dirEnum));
            }

            // advance to the next wall
            tx += dir.x;
            ty += dir.y;

            // exit at full cycle
            if (tx==init_tx && ty==init_ty && dirEnum == init_dirEnum) {
                that.paths.push(path);
                break;
            }
        }
    };

    // iterate through all edges, making a new path after hitting an unvisited wall edge
    i=0;
    for (y=0;y<this.numRows;y++)
        for (x=-2;x<this.numCols+2;x++,i++)
            if (i in edges && !(i in visited)) {
                visited[i] = true;
                makePath(x,y);
            }
};

// count pellets and store energizer locations
Map.prototype.parseDots = function() {

    this.numDots = 0;
    this.numEnergizers = 0;
    this.energizers = [];

    var x,y;
    var i = 0;
    var tile;
    for (y=0; y<this.numRows; y++) for (x=0; x<this.numCols; x++) {
        tile = this.tiles[i];
        if (tile == '.') {
            this.numDots++;
        }
        else if (tile == 'o') {
            this.numDots++;
            this.numEnergizers++;
            this.energizers.push({'x':x,'y':y});
        }
        i++;
    }
};

// get remaining dots left
Map.prototype.dotsLeft = function() {
    return this.numDots - this.dotsEaten;
};

// determine if all dots have been eaten
Map.prototype.allDotsEaten = function() {
    return this.dotsLeft() == 0;
};

// create a record of tunnel locations
Map.prototype.parseTunnels = (function(){
    
    // starting from x,y and increment x by dx...
    // determine where the tunnel entrance begins
    var getTunnelEntrance = function(x,y,dx) {
        while (!this.isFloorTile(x,y-1) && !this.isFloorTile(x,y+1) && this.isFloorTile(x,y))
            x += dx;
        return x;
    };

    // the number of margin tiles outside of the map on one side of a tunnel
    // There are (2*marginTiles) tiles outside of the map per tunnel.
    var marginTiles = 2;

    return function() {
        this.tunnelRows = {};
        var y;
        var i;
        var left,right;
        for (y=0;y<this.numRows;y++)
            // a map row is a tunnel if opposite ends are both walkable tiles
            if (this.isFloorTile(0,y) && this.isFloorTile(this.numCols-1,y))
                this.tunnelRows[y] = {
                    'leftEntrance': getTunnelEntrance.call(this,0,y,1),
                    'rightEntrance':getTunnelEntrance.call(this,this.numCols-1,y,-1),
                    'leftExit': -marginTiles*tileSize,
                    'rightExit': (this.numCols+marginTiles)*tileSize-1,
                };
    };
})();

// teleport actor to other side of tunnel if necessary
Map.prototype.teleport = function(actor){
    var i;
    var t = this.tunnelRows[actor.tile.y];
    if (t) {
        if (actor.pixel.x < t.leftExit)       actor.pixel.x = t.rightExit;
        else if (actor.pixel.x > t.rightExit) actor.pixel.x = t.leftExit;
    }
};

Map.prototype.posToIndex = function(x,y) {
    if (x>=0 && x<this.numCols && y>=0 && y<this.numRows) 
        return x+y*this.numCols;
};

// define which tiles are inside the tunnel
Map.prototype.isTunnelTile = function(x,y) {
    var tunnel = this.tunnelRows[y];
    return tunnel && (x < tunnel.leftEntrance || x > tunnel.rightEntrance);
};

// retrieves tile character at given coordinate
// extended to include offscreen tunnel space
Map.prototype.getTile = function(x,y) {
    if (x>=0 && x<this.numCols && y>=0 && y<this.numRows) 
        return this.currentTiles[this.posToIndex(x,y)];
    if ((x<0 || x>=this.numCols) && (this.isTunnelTile(x,y-1) || this.isTunnelTile(x,y+1)))
        return '|';
    if (this.isTunnelTile(x,y))
        return ' ';
};

// determines if the given character is a walkable floor tile
Map.prototype.isFloorTileChar = function(tile) {
    return tile==' ' || tile=='.' || tile=='o';
};

// determines if the given tile coordinate has a walkable floor tile
Map.prototype.isFloorTile = function(x,y) {
    return this.isFloorTileChar(this.getTile(x,y));
};

Map.prototype.mapPosition = function(pos){
    // normal tile
    if (pos.x>=0 && pos.x<this.numCols && pos.y>=0 && pos.y<this.numRows) {
        return true;
    }
    // tunnel tile
    let tunnel = this.tunnelRows[pos.y];
    if (tunnel && (pos.x < 0)){
        pos.x = this.numCols-1;
        return true;
    }
    else if (tunnel && (pos.x >= this.numCols)){
        pos.x = 0;
        return true;
    }
    // outside of field tile
    return false;
}

Map.prototype.getNeighborPositions = function({x,y}){
    let neighbors = [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}];
    for(let i=3;i>=0;i--){
        if (this.mapPosition(neighbors[i])){
            continue;
        }else{
            neighbors.splice(i,1);
        }
    }
    return neighbors;
}

// mark the dot at the given coordinate eaten
Map.prototype.onDotEat = function(x,y) {
    this.dotsEaten++;
    var i = this.posToIndex(x,y);
    this.currentTiles[i] = ' ';
    this.timeEaten[i] = vcr.getTime();
    renderer.erasePellet(x,y);
};

// creates a heatmap filled with standard values
// -3: wall
// -2: used as starting value in hill climing (to avoid running into walls)
// -1: ghost (set in updateHeatMap)
//  0: floor tile
Map.prototype.createHeatMap = function(){
    // a grid with all the values
    this.heatMap = [];
    for (y=0;y<this.numRows;y++){
        this.heatMap[y] = [];
        for (x=0;x<this.numCols;x++){
            if (this.isFloorTile(x,y)){
                this.heatMap[y][x] = 0;
            }else{
                this.heatMap[y][x] = -3;
            }
        }
    }

}

Map.prototype.setActors = function(pacman, ghosts){
    this.pacman = pacman;
    this.ghosts = ghosts;
}

Map.prototype.updateHeatMap = function(){
    if(this.pacman === null){
        // this will get fired in learn mode
        return;
    }
    let pacman = this.pacman;
    let ghosts = this.ghosts;
    this.createHeatMap();
    for (let i=0;i<4;i++){
        if (ghosts[i].targetting == 'pacman'){
            this.heatMap[ghosts[i].futureTile.y][ghosts[i].futureTile.x] = -1;
        }
    }
    this.heatMap[pacman.tile.y][pacman.tile.x] = 255;

    // Every value > 0 will spread to other tiles (excluding < 0)
    let calcPos = [{'x': pacman.tile.x, 'y': pacman.tile.y}];
    while (calcPos.length > 0){
        let pos = calcPos.shift();
        let neighbors = this.getNeighborPositions(pos);
        for (let neighbor of neighbors){
            if (this.heatMap[neighbor.y][neighbor.x] >= 0 && this.heatMap[neighbor.y][neighbor.x] < this.heatMap[pos.y][pos.x]){
                this.heatMap[neighbor.y][neighbor.x] = this.heatMap[pos.y][pos.x] - 1;
                calcPos.push(neighbor);
            }
        }
    }
}
