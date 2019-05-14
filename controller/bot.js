let Map = require('../libs/map.js');

module.exports = {
    /**
     * Entity position on map grid
     */
    position: {},
    /**
     * Current direction
     */
    direction: 'up',
    lastDirection: '',
    /**
     * Directions that are not allowed to go because of collision
     */
    excludeDirections: [],
    /**
     * Current X axis direction
     */
    dirX: 0,
    /**
     * Current Y axis direction
     */
    dirY: -1,
    /**
     * Target position on map we are heading to
     */
    targetPositions: [{}],
    bombsMax: 1,
    /**
     * Moving speed
     */
    velocity: 12,
    speedIncrease: 1.2,
    canUseBomb: 0,
    isInvincible: 0,
    canWalkThroughWalls: 0,
    idle: 0,
    isTeleport:0, 
    gameCtrl: null,
    
    init: function (map, position) {
        this.position = position;
        console.log("init bot"); //console.log(map);
        this.map = new Map(map.mapData.mapData, 128 * 0.5, map.spawnPointOffsets); //tile-size

        //console.log(this.map);

        //find next target
        this.bfs();
        console.log("starting from: "); console.log(this.position);
    },
    updateMap: function (mapData) {
        if (this.map) {
            this.map.updateMap(mapData);
        }
    },

    updateOpponent: function (playerData) {
        if (this.map)
            this.map.updateOpponent(playerData);
    },

    update: function () {
        if (this.canUseBomb > 0) this.canUseBomb--;
        if (this.isInvincible > 0) this.isInvincible--;
        if (this.canWalkThroughWalls > 0) this.canWalkThroughWalls--;
        if (this.isTeleport > 0) {
            this.isTeleport--;
            if(this.isTeleport == 0){
                this.position = { x: this.map.opponent.x, y:this.map.opponent.y, }
                this.targetPositions[0] = this.position;
                if(this.gameCtrl) this.gameCtrl.teleportTo(this.position.x,this.position.y);
            }
        } 

        let posPlayer = this.map.getGridPosition(this.position.x, this.position.y, true);
        let returnObj = { position: this.position, facing: this.direction, id: Date.now() % 10000 };

        if (this.isReachTarget()) {
            //collect powerup if standing on one ( todo except time trigger )
            if (this.map.hasPowerup(posPlayer.row, posPlayer.col)) {
                returnObj.powerup = true;
            }

            if (this.targetPositions.length > 1) {
                this.targetPositions.shift();
                //if the opponent placed a bomb in the way, calculate a new route
                if (!this.isSafe(this.targetPositions[0])) {
                    this.bfs();
                }
                let way = this.map.getGridPosition(this.targetPositions[0].x, this.targetPositions[0].y, true);
                this.dirX = way.col - posPlayer.col;
                this.dirY = way.row - posPlayer.row;
                this.setDirectionByDir();
                returnObj.facing = this.direction;
                //return {position:this.position, facing:this.direction};
            }

            else if (!returnObj.powerup && (this.canDestroy() || this.wantKillPlayer()) && this.canUseBomb == 0) {
                let tileToSafety = this.canFlee();
                if (tileToSafety != null) {
                    this.targetPositions = tileToSafety;
                    this.loadTargetPosition(tileToSafety[0]);
                    returnObj.bomb = true;
                    //console.log("set bomb--------------------------------------------------------------------------------------");
                    this.map.setBombToPosition(this.position.x, this.position.y);
                    this.idle = 0;
                    this.bfs();
                    //console.log("dir", this.dirX, this.dirY)
                    //return returnObj;
                }
                else {
                    this.bfs();
                }

            }

            else {
                //find next target
                this.bfs();
            }


        }
        if (this.idle < 3) {
            this.moveToTargetPosition();
            returnObj.position = this.position;
            return returnObj;
        }
    },

    /** breadth first search: find the next target */
    bfs: function () {
        this.position = this.map.setToCenterOfTile(this.position);
        var queue = [this.position];
        var score = [];
        var neighbours = [];
        var bestScore = 0;
        var bestIndex = 0;
        var predecessor = {};
        for (var i = 0; i < queue.length; i++) {
            score[i] = this.computeScore(queue[i]);
            //don't process the neighbours of an unsafe node if you're coming from a safe node
            if (score[i] < 0 && typeof predecessor[i] == "number" && score[predecessor[i]] >= 0) {
                continue;
            }
            //we want to find the position with the highest score
            if (score[i] > bestScore) {
                bestScore = score[i];
                bestIndex = i;
            }
            //add all unseen neigbours to the queue to be evaluated
            neighbours = this.map.getNeighbours(queue[i]);
            for (var j = 0; j < neighbours.length; j++) {
                if (this.unseen(queue, neighbours[j])) {
                    queue.push(neighbours[j]);
                    predecessor[queue.length - 1] = i;
                }
            }
        }
        //show idle animation if staying on the same tile longer than 0.3s
        if (bestIndex == 0) this.idle++;
        else this.idle = 0;
        //add all positions on the way to the target list
        this.addTargets(predecessor, queue, bestIndex);
    },

    /** computes a score for a position based on the safety, the number of destructibles around it, if there is a powerup
    *   and the distance to the current position **/
    computeScore: function (pos) {
        if (!this.isSafe(pos)) return -1;
        if (pos.x === this.position.x && pos.y === this.position.y) return 0;
        //reduce the score of the previous position to not have the bot switching between 2 places all of the time when no destructible in sight
        if (this.isPreviousPosition(pos)) return 0;
        let posGrid = this.map.getGridPosition(pos.x, pos.y, false);
        let playerGrid = this.map.getGridPosition(this.position.x, this.position.y, true);
        //base score 3, add 6 per destructible
        let score = 3;
        //add 15 if the spot contains a powerup except i cannot collect them at the moment because of other active power ups
        if (this.map.hasPowerup(posGrid.row, posGrid.col) && this.isInvincible == 0 && this.canWalkThroughWalls == 0) score += 18;
        else score += this.map.getNumberOfDestructibles(posGrid.row, posGrid.col) * 6;
        //if the opponent is close, add points
        if (this.map.opponentClose(posGrid.row, posGrid.col)) {
            if (this.isInvincible > 30 || this.map.almostEmptyField()) score += 150;
            else score += 15;
        }
        //subtract the manhattan distance from teh score -> closer is better
        score -= this.map.getDistance(posGrid.row, posGrid.col, playerGrid.row, playerGrid.col);

        return score;
    },



    /** checks if a position was visited already */
    unseen: function (queue, pos) {
        for (var i = 0; i < queue.length; i++) {
            if (queue[i].x === pos.x && queue[i].y === pos.y) return false;
        }
        return true;
    },

    /** adds the position and all predecessors to the target list */
    addTargets: function (predecessor, queue, index) {
        var pos = queue[index];
        this.targetPositions = [pos];
        //don't add start node to the list of targets
        while (predecessor[index] !== undefined && predecessor[index] != null && predecessor[index] != 0) {
            this.targetPositions.unshift(queue[predecessor[index]]);
            index = predecessor[index];
        }
        this.loadTargetPosition(this.targetPositions[0]);
    },

    powerupAcquired: function (data) {
        if (data.powerupType === 7) this.velocity += this.speedIncrease;
        else if (data.powerupType == 8) this.canWalkThroughWalls = 150;
        else if (data.powerupType == 9) this.isInvincible = 150;
        else if (data.powerupType == 11) this.isTeleport = 10;
    },

    /**
     * Moves a step forward to target position.
     */
    moveToTargetPosition: function () {

        var targetPosition = { x: this.position.x + this.dirX * this.velocity, y: this.position.y + this.dirY * this.velocity };
        //disabling collission detection because else the bot gets always stuck on his own bombs
        //if (this.map.canMoveTo(true, targetPosition.x, targetPosition.y)) {
        this.position.x = targetPosition.x;
        this.position.y = targetPosition.y;
        //}
    },

    isReachTarget: function () {
        if (this.direction === 'right') {
            if (this.position.x >= this.targetPositions[0].x) return true;
        } else if (this.direction === 'left') {
            if (this.position.x <= this.targetPositions[0].x) return true;
        } else if (this.direction === 'down') {
            if (this.position.y >= this.targetPositions[0].y) return true;
        } else if (this.direction === 'up') {
            if (this.position.y <= this.targetPositions[0].y) return true;
        }

        return false;
    },



    /**
     * Loads vectors and animation name for target position.
     */
    loadTargetPosition: function (position) {

        this.dirX = (position.x - this.position.x) / 64;
        this.dirY = (position.y - this.position.y) / 64;
        this.setDirectionByDir();
    },

    isPreviousPosition: function (pos) {
        var previous = this.map.getGridPosition(this.targetPositions[0].x, this.targetPositions[0].y, true);
        previous.col -= this.dirX;
        previous.row -= this.dirY;
        pos = this.map.getGridPosition(pos.x, pos.y, false);
        return (previous.col == pos.col && previous.row == pos.row);
    },


    /**
     * Checks whether there are any destructlibles around.
     */
    canDestroy: function () {
        let playerGrid = this.map.getGridPosition(this.position.x, this.position.y, true);
        if (this.map.getNumberOfDestructibles(playerGrid.row, playerGrid.col)) return true;
        return false;
    },

    /**
     * checks if the player can flee if placing a bomb here (does not consider blast increase powerup)
     * */
    canFlee: function () {
        let current = this.map.setToCenterOfTile(this.position);
        let neighbours = this.map.getNeighbours(current);
        let nn;
        for (var i = 0; i < neighbours.length; i++) {
            nn = this.map.getNeighbours(neighbours[i]);
            for (var j = 0; j < nn.length; j++) {
                if (this.unseen(neighbours, nn[j]) && !(current.x == nn[j].x && current.y == nn[j].y) && this.isSafe(nn[j])) {
                    return [neighbours[i], nn[j]];
                }

            }
        }
        return null;
    },

    /**
     * Checks whether player is near. If yes and we are angry, return true.
     */
    wantKillPlayer: function () {
        let playerPos = this.map.getGridPosition(this.position.x, this.position.y, true);
        var isNear = this.map.opponentClose(playerPos.row, playerPos.col);
        var isAngry = Math.random() > 0.25;
        if (isNear && isAngry) {
            return true;
        }
        return false;
    },

    isSafe: function (position) {
        var bombs = this.map.getBombs();
        //console.log("isSafe", this.map.getGridPosition(position.x, position.y, true))
        // console.log("isSafe")
        for (var i = 0; i < bombs.length; i++) {
            //console.log(bombs[i])
            var bomb = bombs[i];
            var fire = bomb.dangerPositions;
            for (var j = 0; j < fire.length; j++) {
                if (this.map.comparePositions(fire[j], this.map.getGridPosition(position.x, position.y, true))) {
                    return false;
                }
            }
        }
       // console.log("isSafe true")
        return true;
    },




    setBomb: function (data) {
        if (this.map === undefined) return;
        this.canUseBomb = 24;
    },


    setDirectionByDir: function () {
        if (this.dirX == 1 && this.dirY == 0) {
            this.direction = 'right';
        } else if (this.dirX == -1 && this.dirY == 0) {
            this.direction = 'left';
        } else if (this.dirX == 0 && this.dirY == 1) {
            this.direction = 'down';
        } else if (this.dirX == 0 && this.dirY == -1) {
            this.direction = 'up';
        }
    }
};
