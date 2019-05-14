/**
* super smart tronman bot-system
*
*/

const bots = require('./bots/bots2.json');
let mCtrl = require('./controller/mainCtrl.js');

let s1 = require('socket.io-client')('https://bitcoinbomber.app');
let mCtrl1 = new mCtrl(s1, "ln");

start(2, 40);

async function start(maxStake, minBotBalance) {
  let bot = await getRndBot(minBotBalance);
  if(bot==0) {
      console.log("all bots out of money");
      return;
    }
    console.log("new bot: "+bot.address.base58+", "+bot.username);
    s1.connect();
    setTimeout(function() {
      console.log("id: "+s1.id);
      let nrGames = Math.floor(Math.random() * (bot.bal/5));
      console.log("bot plays "+nrGames+" games");
      mCtrl1.init(bot, s1.id, nrGames, function() {
        s1.close();
        start();
      });
    },2000);
}

async function getRndBot(minBal) {
    let bot=0;
    for(var i=0;i<bots.length;i++) {
      let bal = 100;
      console.log("balance of "+bots[i].username+", "+bots[i].address.base58+": "+bal);
      if(bal>minBal) {
        bot=bots[i]; 
        bot.bal = bal;
        break;
      }
    }
    return bot;

}
