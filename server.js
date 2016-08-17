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
      'KL1400' : ['1129479503756044','748955295208120','1039929506083473'],
      'KL1100' : ['748955295208120','1039929506083473','1129479503756044'],
      'KL1600' : ['748955295208120','1039929506083473','1129479503756044'],
      'AF1400' : ['748955295208120','1039929506083473','1129479503756044'],
      'AF1100' : ['748955295208120','1039929506083473','1129479503756044'],
      'AF1600' : ['748955295208120','1039929506083473','1129479503756044']
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
              /*console.log("senderid :" + senderid);
               var recipientID = messagingEvent.recipient.id;
              console.log("recipientID " +  recipientID)*/
              
              if(typeof store.userConversationMap === 'undefined' || typeof store.userConversationMap[senderid] === 'undefined'){
                 initSession(senderid);
              }
              
             if (messagingEvent.message) {
                console.log("Next Action ---> "+store.userConversationMap[senderid].nextExpectedAction);
                if(messagingEvent.message.text == "end"){
                  store.userConversationMap[senderid].nextExpectedAction = 'chooseIdentification';
                  sendMessage(senderid,"Your current session is ended.");
                }
                else if(store.userConversationMap[senderid].nextExpectedAction == 'pnrCheck' || store.userConversationMap[senderid].nextExpectedAction == 'e-tktCheck' ||
                  store.userConversationMap[senderid].nextExpectedAction == 'fqtCheck')
                  checkIdentification(senderid,store.userConversationMap[senderid].nextExpectedAction,messagingEvent.message);
                else if(store.userConversationMap[senderid].nextExpectedAction == 'itinerary'){
                  receivedPostBackForquickreply(senderid, store.userConversationMap[senderid].nextExpectedAction,messagingEvent.message.quick_reply.payload);
                }
                else
                  sendGenericMessage(senderid);
             }
             else if (messagingEvent.postback) {
              if(store.userConversationMap[senderid].nextExpectedAction == 'chooseIdentification') {
                  receivedPostBackForIdentification(req, messagingEvent);
              }
              else {
                sendMessage(senderid,"Your input is invalid for current question. Do you want end the session??");    
              }
            }       
              
          })
          });
      } 
    res.sendStatus(200);
  });


function initSession(senderid) {
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

function receivedPostBackForquickreply(senderid, mode,message){
 
  if (message) {
    switch (message) {
      case 'itinerary':
        setSession('pnrCheck',senderid);
        sendItinerary(senderid);
        setTimeout(function() {
          quickreplies_checkin(senderid);
        }, 5000);
        break;
      case 'checkin':
        setSession('e-tktCheck',senderid);
        sendCheckin(senderid);
        break;
      case 'checkin-yes':
        sendCheckin(senderid);
        break;
    }
  }
}

function receivedPostBackForIdentification(req, event){
  var payload = event.postback.payload;
  var senderID = event.sender.id;
  var modeofselection = 0;
  if (payload) {
    switch (payload) {
      case 'PNR-ENTRY':
        modeofselection = 1;
        setSession('pnrCheck',senderID);
        sendMessage(senderID,"Please enter your PNR");
        break;

      case 'eTICKET-ENTRY':
        modeofselection = 2;
        setSession('e-tktCheck',senderID);
        sendMessage(senderID, "Please enter your eTicket Number");
        break;

      case 'Frequentflyer-ENTRY':
        modeofselection = 3;
        setSession('fqtCheck',senderID);
        sendMessage(senderID, "Please enter your Frequentflyer Number");
        break;
      default:
        modeofselection = 0;
        //initSession(senderID);
        //sendGenericMessage(senderID);
    }
  } 
}

function checkIdentification(recipientId, mode, message){
   var itinerary = getJson('getItinerary');
   if(mode == "pnrCheck"){
      if(itinerary.attachment.payload.pnr_number == message.text){
        //sendItinerary(recipientId);
        quickreplies(recipientId);
        setSession('itinerary',recipientId);
      }  
      else
       sendMessage(recipientId,"Your PNR is invalid. Please re-enter");  
   }
   else if (mode == "e-tktCheck"){}
   else if (mode == "fqtCheck"){}
}

function addNewSender(recipientId){
  if(senderID_arr.indexOf(recipientId) == -1){
     senderID_arr.push(recipientId);
  }
}

function sendMessage(recipientId, message){
  //addNewSender(recipientId);
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

function setSession(triggerPoint,recipientId){
  if(store.userConversationMap)
        store.userConversationMap[recipientId].nextExpectedAction = triggerPoint;
}

function receivedIdentificationMessage(event){
  sendItinerary(event.sender.id);
}

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var triggerPoint ='';
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
        triggerPoint = '';
        break;
      case 'itinerary':
        sendItinerary(senderID);
        triggerPoint = '';
        break;
      case 'checkin':
        sendCheckin(senderID);
        triggerPoint = '';
        break;
      case 'flightstatus':
        sendFlightStatus(senderID);
        triggerPoint = '';
        break;
      case 'boardingpass':
        sendBoardingPass(senderID);
        triggerPoint = '';
        break;
      default:
        sendMessage(senderID, messageText);
        triggerPoint = '';
    }
    setSession(triggerPoint,recipientID);
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
  //addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('generic')
    
  };
  callSendAPI(messageData);
}


function sendItinerary(recipientId){
  //addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getItinerary')
  };                
   callSendAPI(messageData);
}

function sendCheckin(recipientId){
  //addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getCheckin')
  };
  callSendAPI(messageData);
}

function sendFlightStatus(recipientId){
  //addNewSender(recipientId);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getStatus')
  };
   callSendAPI(messageData);
}

function sendBoardingPass(recipientId){
  //addNewSender(recipientId);
  var messageData = {
    "recipient": {
      "id": recipientId
    },
     "message": getJson('getbp') 
  };
                
   callSendAPI(messageData);
}

function quickreplies(recipientId){
  var messageData = {
    "recipient": {
      "id": recipientId
    },
     "message": getJson('quickreply') 
  };
                
   callSendAPI(messageData);
}

function quickreplies_checkin(recipientId){
  var messageData = {
    "recipient": {
      "id": recipientId
    },
     "message": getJson('quickreplyCheckin') 
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
  setTimeout(broadCastMessage, 5000);
  console.log('Server is up and running...');
});