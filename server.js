//
// # SimpleServer
//
// A simple airline checkin application.
//

var store = {};
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    path = require("path"),
    request = require('request'),
    senderID_arr = [],
    messages = {
      'code0' : ' is closed',
      'code1' : ' is delayed'
    },
    flightgrp = {
      'KL1400' : ['748955295208120','1039929506083473'],
      'KL1100' : ['748955295208120','1039929506083473'],
      'KL1600' : ['748955295208120','1039929506083473'],
      'AF1400' : ['748955295208120','1039929506083473'],
      'AF1100' : ['748955295208120','1039929506083473'],
      'AF1600' : ['748955295208120','1039929506083473'],
    },
    welcomeMessage = "Greetings! We are here to help you with checkin and other available feature in checkin phase for multiple airlines, please choose your airline…",
    airlineSelection = getJson('airlines');

app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, 'client')));

var cookieParser = require('cookie-parser')
var session = require('express-session');
app.use(cookieParser('S3CRE7'));
app.use(session());

app.get('/init',function(req,res){
  res.sendFile(__dirname+'/client/index.html');
});

app.get('/admin',function(req,res){
  res.sendFile(__dirname+'/client/admin.html');
});

app.get('/test', function (req, res) {
  res.send('Hello World!');
});

app.get('/sendMessage', function (req, res) {
  sendadminMessage(messages[req.query.code], flightgrp[req.query.flight_info],req.query.flight_info);
});

app.post('/webhook', function (req, res) {
  
  console.log(store);
        var data = req.body;
        if (data.object == 'page') {
          data.entry.forEach(function(pageEntry) {
          pageEntry.messaging.forEach(function(messagingEvent) {
            var senderid = messagingEvent.sender.id;
            initSession(senderid);
          if (messagingEvent.message) {
            sendGenericMessage(senderid);
            }
          else if (messagingEvent.postback) {
              if (store.userConversationMap != undefined && store.userConversationMap[senderid] != undefined && store.userConversationMap[senderid].nextExpectedAction == 'chooseIdentification') {
                  receivedPostBackForIdentification(req, messagingEvent);
              } else {
                initSession(senderid);
                sendGenericMessage(senderid);    
              }
        }
          })
          });
      } 
    res.sendStatus(200);
  });

function initSession(senderid) {
  console.log("senderid :" + senderid);
  console.log("store.userConversationMap :" + store.userConversationMap);
  if(store.userConversationMap == undefined) {
     store.userConversationMap = {}; 
    }
  if (store.userConversationMap[senderid] == undefined) {
    console.log("store.userConversationMap[senderid] :" + store.userConversationMap[senderid]);
    var userData = {};
    userData['nextExpectedAction'] = 'chooseIdentification';
    store.userConversationMap[senderid] = userData;
  }
}

function getJson(filename){
 var contents = require(__dirname+'/client/data/'+filename+'.json');
 return contents;
}

function receivedPostBackForIdentification(req, event){
  var payload = event.postback.payload;
  var senderID = event.sender.id;
  var modeofselection = 0;
  if (payload) {
    switch (payload) {
      case 'PNR-ENTRY':
        modeofselection = 1;
        sendMessage(senderID,"Please enter your PNR");
        break;

      case 'eTICKET-ENTRY':
        modeofselection = 2;
        sendMessage(senderID, "Please enter your eTicket Number");
        break;

      case 'Frequentflyer-ENTRY':
        modeofselection = 3;
        sendMessage(senderID, "Please enter your Frequentflyer Number");
        break;
      default:
        modeofselection = 0;
        initSession(senderID);
        sendGenericMessage(senderID);
    }
  } 
}

function addNewSender(recipientId){
  if(senderID_arr.indexOf(recipientId) == -1){
     senderID_arr.push(recipientId);
  }
}

function sendMessage(recipientId, message){
  addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: message
    }
  };

  callSendAPI(messageData);
}

function receivedIdentificationMessage(event){
  sendItinerary(event.sender.id);
}

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'generic':
        sendGenericMessage(senderID);
        break;
      case 'itinerary':
        sendItinerary(senderID);
        break;
      case 'checkin':
        sendCheckin(senderID);
        break;
      case 'flightstatus':
        sendFlightStatus(senderID);
        break;
      case 'boardingpass':
        sendBoardingPass(senderID);
        break;
      default:
        sendMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendMessage(senderID, "Message with attachment received");
  }
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: "EAAEYZCvXjIksBABoD9oVmZAfguZBjnojimEtNlZBMAY2bD0OkqeaZBmGcZB62SVraANcbz4yBSGI0z2iJerTThbg6GJThZAfPb0u4X1D2O0Pi5ALzZBpjus0CLBrsYmW6pUpzLDhqhpfOdl7uoTFA9qzB1mdMBVZB0KThZAhpB3JR4gAZDZD" },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

function sendGenericMessage(recipientId) {
  addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('generic')
  };  
  callSendAPI(messageData);
}


function sendItinerary(recipientId){
  addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getItinerary')
  };                
   callSendAPI(messageData);
}

function sendCheckin(recipientId){
  addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getCheckin')
  };
  callSendAPI(messageData);
}

function sendFlightStatus(recipientId){
  addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getStatus')
  };
   callSendAPI(messageData);
}

function sendBoardingPass(recipientId){
  addNewSender(recipientId);
  var messageData = {
    "recipient": {
      "id": recipientId
    },
     "message": getJson('getbp') 
  };
                
   callSendAPI(messageData);
}

function broadCastMessage(){
  var message = '';
  for(var i in senderID_arr){
    sendMessage(senderID_arr[i], welcomeMessage);
    message =  {
        "recipient": {
          "id": senderID_arr[i]
        },
         "message": airlineSelection 
      };
    callSendAPI(message);
  }  
  setTimeout(broadCastMessage, 2*60*60*1000);  
}

function sendadminMessage(message, recipientList,flight_info){
  for(var i in recipientList){
    message = "Your flight No : "+ flight_info + message +"\nWe are sorry for inconvenience caused.";
    sendMessage(recipientList[i], message);
  } 
}

app.listen(process.env.PORT, function () {
  //setTimeout(broadCastMessage, 5000);
  console.log('Server is up and running...');
});