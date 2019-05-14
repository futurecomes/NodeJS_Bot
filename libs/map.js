

const Map = function (data, tileSize, spawnPointOffsets) {
    // initialize map by parsing the tilemap data from the client into a 2d array.
    this.mapData = data;
    this.placedBombs = null;
    this.tileSize = tileSize;
    this.spawnPointOffsets = spawnPointOffsets;
    this.opponent = {};
};

Map.prototype = {
    // Return the type of block that a tile represents.
    hitTest: function (x, y) {
        x -= this.spawnPointOffsets.x;
        y -= this.spawnPointOffsets.y;
        const row = Math.floor(y / this.tileSize),
            col = Math.floor(x / this.tileSize);

        let hitBlock = -1;
        if (this.mapData[row] !== undefined && this.mapData[row][col] !== undefined) {
            hitBlock = this.mapData[row][col];
        }

        return {
            row: row,
            col: col,
            hitBlock: hitBlock
        };
    },
    
    updateMap: function (map) {
        this.mapData = map.mapData;
        this.placedBombs = map.placedBombs;
    }, 
    
    setBombToPosition: function (x, y) {
        const {row, col} = this.getGridPosition(x, y, true);
        if(this.placedBombs){
            this.placedBombs[row][col] = 2;
            console.log("setBombToPosition", row, col);
           // console.log("this.placedBombs", this.placedBombs);
            
        }
        
    },

    updateOpponent: function (playerData) {
        this.opponent = playerData;
    },
    
    hitTestInMap: function (row, col) {
        if (this.mapData[row] !== undefined && this.mapData[row][col] !== undefined) {
            return this.mapData[row][col];
        }
        return undefined;
    },

    canMoveTo: function (player, x, y) {
        const {row, col} = this.getGridPosition(x, y, true);
        if (row < 0 || row > this.mapData.length - 1) return false;
        if (col < 0 || col > this.mapData[0].length - 1) return false;
        if(this.placedBombs){
            if (this.placedBombs[row][col] >= 1) return false;
        }
        //cannot move on destructible, block, or trigger powerup
        if (this.mapData[row][col] === 1 || this.mapData[row][col] === 2 || this.mapData[row][col] === 10) {
            //if(!player.pass)
                return false;
        }
        return true;
    },

    getGridPosition: function (x, y, isPlayer) {
        var erX = 0, erY = 0;

        if (isPlayer) {
            erX = 0;
            erY = -15;
        }
        const row = Math.floor((y - this.spawnPointOffsets.y + erY) / this.tileSize),
            col = Math.floor((x - this.spawnPointOffsets.x + erX) / this.tileSize);
        return {row: row, col: col};
    },

    getPosition: function (row, col, isPlayer) {
        var erX = this.tileSize/2, erY = this.tileSize/2;

        if (isPlayer) {
            erX = this.tileSize/2;
            erY = this.tileSize/2;
        }
        const y = Math.floor(row * this.tileSize + this.spawnPointOffsets.y + erY),
            x = Math.floor(col * this.tileSize + this.spawnPointOffsets.x + erX);
        return {x: x, y: y};
    },

    setToCenterOfTile: function (player) {
        var posit = this.getGridPosition(player.x, player.y);
        return this.getPosition(posit.row, posit.col);
    },
    
    //returns the number of destructibles around the slot
    getNumberOfDestructibles: function(row, col){
        if (row < 0 || row > this.mapData.length - 1) return 0;
        if (col < 0 || col > this.mapData[0].length - 1) return 0;
        let num = 0;
        if(col > 0){
            if (this.mapData[row][col-1] === 2) num++;
        }
        if(col < this.mapData[0].length - 1){
            if (this.mapData[row][col+1] === 2) num++;
        }
        if(row > 0){
            if (this.mapData[row-1][col] === 2) num++;
        }
        if(row < this.mapData.length - 1){
            if (this.mapData[row+1][col] === 2) num++;
        }
        return num;
    },
    
    //returns true if there is a powerup on the given position, except it is a trigger
    hasPowerup: function(row, col){
        if (row < 0 || row > this.mapData.length - 1) return false;
        if (col < 0 || col > this.mapData[0].length - 1) return false;
        if (this.mapData[row][col] > 4 && this.mapData[row][col]!= 10) return true;
    },
    
    //returns the manhattan distance between two points
    getDistance: function(row1, col1, row2, col2){
        let dist = 0;
        if(row1 < row2) dist += row2 - row1;
        else dist += row1 - row2;
        if(col1 < col2) dist += col2 - col1;
        else dist += col1 - col2;
        return dist;
    },

    getBombs: function () {
        var bombs = [];
        if(this.placedBombs){
            for(var row = 0; row<this.placedBombs.length; row++){
                for(var col = 0; col<this.placedBombs[row].length; col++){
                    if(this.placedBombs[row][col] !== 0){
                        var power = this.placedBombs[row][col];
                        var dangerPositions = [{row: row, col: col}];
                        var startRowDanger = row - power;
                        if(startRowDanger<0){
                            startRowDanger=0;
                        }
                        var endRowDanger = row + power;
                        if(endRowDanger > this.mapData.length - 1){
                            endRowDanger = this.mapData.length - 1;
                        }
                        for(var i = startRowDanger; i <= endRowDanger; i++){
                            dangerPositions.push({row: i, col: col});
                        }

                        var startColDanger = col - power;
                        if(startColDanger<0){
                            startColDanger=0;
                        }
                        var endColDanger = col + power;
                        if(endColDanger > this.mapData[0].length - 1){
                            endColDanger = this.mapData[0].length - 1;
                        }
                        for(var i = startColDanger; i <= endColDanger; i++){
                            dangerPositions.push({row: row, col: i});
                        }
                        bombs.push({row: row, col: col, dangerPositions:dangerPositions})
                    }
                    
                }
            }
        }
        return bombs;
    },
    
    opponentClose: function (row, col) {
        if(typeof this.opponent.x == "number"){
            let opponentGrid = this.getGridPosition(this.opponent.x, this.opponent.y, true);
            let distance = this.getDistance(row, col, opponentGrid.row, opponentGrid.col);
            if(distance <= 1){
                return true;
            } 
        }
        return false; 
    },

    comparePositions: function (firstPosition, secondPosition) {
        return (firstPosition.row == secondPosition.row && firstPosition.col == secondPosition.col);
    },
    
    /** returns all accessible neighbours **/
      getNeighbours: function(pos){
        var targets = [];
        pos = this.getGridPosition(pos.x, pos.y, true);
        var pos2;
        for (var i = 0; i < 4; i++) {
          var dirX = 0;
          var dirY = 0;
          if (i == 0) {
            dirX =1;
            dirY = 0;
          } else if (i == 1) {
            dirX = -1;
            dirY = 0;
          } else if (i == 2) {
            dirX = 0;
            dirY = 1;
          } else if (i == 3) {
            dirX = 0;
            dirY = -1;
          }
    
          pos2 = {
            row: pos.row + dirY,
            col: pos.col + dirX
          };
          let position = this.getPosition(pos2.row, pos2.col, true);
          if(this.canMoveTo({pass:true}, position.x, position.y)) {
            targets.push(position);
          }
        }
        return targets;
      },
      
      almostEmptyField: function(){
          let numDestructibles = 0;
          for(var row = 0; row<this.mapData.length; row++){
                for(var col = 0; col<this.mapData[row].length; col++){
                    if(this.mapData[row][col] == 2) numDestructibles++;
                    if(numDestructibles>3) return false;
                }
          }
          return true;
      }
};

module.exports = Map;
