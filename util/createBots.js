const TronWeb = require('tronweb');
const eventServer = 'https://api.trongrid.io/';
const HttpProvider = TronWeb.providers.HttpProvider; // This provider is optional, you can just use a url for the nodes instead
const fullNode = new HttpProvider('https://api.trongrid.io'); // Full node http endpoint
const solidityNode = new HttpProvider('https://api.trongrid.io'); // Solidity node http endpoint

const fs = require('fs');
let whalePk = "";
let tronWeb = new TronWeb(
  fullNode,
  solidityNode,
  eventServer,
  whalePk
);

let teamsIndices = {
  'vikings': 0,
  'pirates': 1,
  'samurais': 2,
  'rebels': 3
};

let names = require('./names');
let bots = [];


function createBots(nr, amount) {
  let createdBots = 0;

  async function createBot() {
    if (createdBots >= nr) {
      fs.writeFile("./bots.json", JSON.stringify(bots), function(err) {
        if (err) {
          return console.log(err);
        }
        console.log("The file was saved!");
      });
    } else {
      let bot = await tronWeb.createAccount();
      console.log(bot);
      let rnd = Math.floor(Math.random() * names.length);
      bot.username = names[rnd];
      let rndTeam =  Math.floor(Math.random() * 4);
      for(t in teamsIndices) if(teamsIndices[t]==rndTeam) bot.tId=t;
      bot.playedGames=0;
      bots.push(bot);
      distributeFunds(bot.address.base58, amount, function() {
        createdBots++;
        createBot();
      });
    }
  }
  createBot();
}


async function distributeFunds(address, amount, callb) {
  await tronWeb.trx.sendTransaction(address, tronWeb.toSun(amount), whalePk);
  callb();
}

function addFunds(amount) {
  fs.readFile('./bots/trx/bots1.json', function (err, data) {
    if (err) {
      throw err;
    }
    

    bots = JSON.parse(data.toString());

    let distributed=0;
    distribute();

    async function distribute() {
      if(distributed<bots.length)
      distributeFunds(bots[distributed].address.base58, amount, function() {
        console.log("sent "+amount+" to: "+bots[distributed].address.base58);
        distributed++;
        distribute();
      });
    }
  });
}


function register() {
  this.socket = require('socket.io-client')('http://localhost:8082');
  this.socket.close();
  let parent = this;
  let registred=0;
  this.emitWithAuth = function (eventName, ...args) {
      if (parent.socket.token) {
          var newArgs = [eventName, parent.socket.token].concat(args);
          parent.socket.emit.apply(parent.socket, newArgs);
      }
  };

  fs.readFile('./bots.json', function (err, data) {
    if (err) {
      throw err;
    }
     bots = JSON.parse(data.toString());
     setTeam();
   });

   function setTeam() { //address format???
     if(registred<bots.length) {
       parent.socket.connect();
       parent.socket.emit("authenticate", { address: bots[registred].address.hex.toLowerCase()}, function (res) {
           if (res && res.token) {
               this.token = res.token;
               console.log("authenticated.");
               parent.emitWithAuth("wallet found", { adr: bots[registred].address.hex.toLowerCase() }, function (usr) {
                  console.log(usr);
                 parent.emitWithAuth("team selected", { adr: bots[registred].address.hex.toLowerCase(), tId: bots[registred].tId, username: bots[registred].username }, function (res) {
                   console.log(bots[registred].username+", "+ bots[registred].address.hex+" registred");
                   console.log(res);
                   registred++;
                   parent.socket.close();
                   setTeam();
                 });
               });
           }
         });
    }
    else {
      console.log("done");
    }
  }
}



/**********************************************************************************************************
  start
*/

//nr of bots, nr of trx to send
//createBots(10, 15);

addFunds(100);

//register();
