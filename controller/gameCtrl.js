/**
* todo: restructure
*/
const bot = require('./bot.js');

class gameCtrl {

    constructor(mCtrl) {
        this.mCtrl = mCtrl;
        this.botMove = 0;
        this.speed = 32;
        this.speedIncrease = 3.2;
    }


    startPlaying(data, playerId, gameId, callb) {
        console.log("bot starting to move. players: ");
        for (var p in data.players) {
            console.log(data.players[p].username);
        }
        this.callb = callb;
        if (this.speed == undefined) {
            this.speed = 32;
            this.speedIncrease = 3.2;
        }
        let parent = this;
        data.map.mapData = this.map;

        bot.init(data.map, { x: data.players[playerId].x, y: data.players[playerId].y });
        let move = false;
        this.botMove = setInterval(function () {
            move = bot.update();
            if (typeof move !== "undefined") {
                if (move.bomb) {
                    callb("place bomb", { x: move.position.x, y: move.position.y, id: move.id });
                }
                else if (move.powerup) {
                    callb("powerup overlap", { x: move.position.x, y: move.position.y });
                }
                else {
                    callb("move player", { x: move.position.x, y: move.position.y, facing: move.facing, speed: parent.speed });
                }
            }

        }, 100);

    }

    stopPlaying() {
        clearInterval(this.botMove);
    }

    updateMap(newMap) {
        bot.updateMap(newMap);
        this.map = newMap;
    }

    updateOpponent(newOpp) {
        bot.updateOpponent(newOpp);
    }

    placeBomb(data) {
        bot.setBomb(data);
    }

    powerupAcquired(data) {
        if (data.powerupType === 7) this.speed += this.speedIncrease;
        if (data.powerupType === 11){
            setTimeout(() => {let posit = bot.teleport(); 
                              this.callb("teleport to tile", {"x": posit.x, "y": posit.y}) 
            }, 1000);
            bot.gameCtrl = this;
        } 
        bot.powerupAcquired(data);
    }

    teleportTo(x, y){
        this.callb("teleport to tile", {"x": x, "y": y}); 
    }
}
module.exports = gameCtrl;