//
// # SimpleServer
//
// A simple airline checkin application.
//

var store = {},
    express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    path = require("path"),
    request = require('request'),
    senderID_arr = [],
    qflowtype='',
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
    welcomeMessage = "Greetings! We are here to help you with checkin and other available feature in checkin phase for klm airline, please choose your start over from menu…",
    airlineSelection = getJson('airlines');

app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, 'client')));


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
        var data = req.body;
        if (data.object == 'page') {
          data.entry.forEach(function(pageEntry) {
          pageEntry.messaging.forEach(function(messagingEvent) {
            var senderid = messagingEvent.sender.id;
              if(typeof store.userConversationMap === 'undefined' || typeof store.userConversationMap[senderid] === 'undefined'){
                 initSession(senderid);
              }
              
             if (messagingEvent.message) {
                console.log("Next Action ---> "+store.userConversationMap[senderid].nextExpectedAction);
                if(messagingEvent.message.text && (messagingEvent.message.text).toLowerCase() == "end"){
                  endMessage(senderid, 0);
                }
                else if(store.userConversationMap[senderid].nextExpectedAction == 'pnrCheck' || store.userConversationMap[senderid].nextExpectedAction == 'e-tktCheck' ||
                  store.userConversationMap[senderid].nextExpectedAction == 'fqtCheck')
                  checkIdentification(senderid,store.userConversationMap[senderid].nextExpectedAction,messagingEvent.message);
                else if(store.userConversationMap[senderid].nextExpectedAction == 'itinerary' || store.userConversationMap[senderid].nextExpectedAction == 'viewItinerary'){
                  receivedPostBackForquickreply(senderid, store.userConversationMap[senderid].nextExpectedAction,messagingEvent.message.quick_reply.payload);
                }
                else if(store.userConversationMap[senderid].nextExpectedAction == 'checkin-yes'){
                  sendMessage(senderid,"Your Checkin is successfull. Please view the boardingpass below");  
                  sendBoardingPass(senderid);
                  endMessage(senderid, 3000);
                }
                else if(store.userConversationMap[senderid].nextExpectedAction == 'chooseIdentification'){
                  sendMessage(senderid,welcomeMessage); 
                }
                else if(store.userConversationMap[senderid].nextExpectedAction == 'chooseIdentification' && (messagingEvent.message.text).toLowerCase() == "start over")
                  {
                    sendGenericMessage(senderid);
                  }
             }
             else if (messagingEvent.postback) {
              if(store.userConversationMap[senderid].nextExpectedAction == 'chooseIdentification' && (messagingEvent.postback.payload == "start" || messagingEvent.postback.payload == "qgetbp" || messagingEvent.postback.payload == "qgetflightstatus" )){
                  qflowtype = messagingEvent.postback.payload;
                  sendGenericMessage(senderid);
              }
              else if(store.userConversationMap[senderid].nextExpectedAction == 'chooseIdentification') {
                  receivedPostBackForIdentification(req, messagingEvent);
              }
              else {
                sendMessage(senderid,"Your input is invalid for current question. please re enter");    
              }
            }       
              
          })
          });
      } 
    res.sendStatus(200);
  });


function initSession(senderid) {
  if(store.userConversationMap == undefined) {
     store.userConversationMap = {}; 
    }
  if (store.userConversationMap[senderid] == undefined) {
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
        setSession('viewItinerary',senderid);
        sendItinerary(senderid);
        setTimeout(function() {
          quickreplies_checkin(senderid);
        }, 3000);
        break;
      case 'checkin':
      case 'checkin-yes':
        sendBoardingPass(senderid);
        endMessage(senderid, 3000);
        break;
      case 'checkin-no':
        endMessage(senderid, 0);
        break;  
    }
  }
}

function receivedPostBackForIdentification(req, event){
  var payload = event.postback.payload;
  var senderID = event.sender.id;
  if (payload) {
    switch (payload) {
      case 'PNR-ENTRY':
        setSession('pnrCheck',senderID);
        sendMessage(senderID,"Please enter your PNR");
        break;

      case 'eTICKET-ENTRY':
        setSession('e-tktCheck',senderID);
        sendMessage(senderID, "Please enter your eTicket Number");
        break;

      case 'Frequentflyer-ENTRY':
        setSession('fqtCheck',senderID);
        sendMessage(senderID, "Please enter your Frequentflyer Number");
        break;
      
    }
  } 
}

function decideFlows(recipientId){
  if(qflowtype == "qgetbp"){
          sendBoardingPass(recipientId);
          endMessage(recipientId, 3000);
          qflowtype = '';
        }
        else if(qflowtype == "qgetflightstatus"){
          sendFlightStatus(recipientId);
          endMessage(recipientId, 3000);
          qflowtype = '';
        }
        else{
          setSession('itinerary',recipientId);
          quickreplies(recipientId);
        }
}

function checkIdentification(recipientId, mode, message){
   var itinerary = getJson('getItinerary');
   if(mode == "pnrCheck"){
      if((itinerary.attachment.payload.pnr_number).toLowerCase() == (message.text).toLowerCase()){
        decideFlows(recipientId);
      }  
      else
       sendMessage(recipientId,"Your PNR is invalid. Please re-enter");  
   }
   else if (mode == "e-tktCheck"){
     if("1111111111111" == message.text){
        decideFlows(recipientId);
      }  
      else
       sendMessage(recipientId,"Your e-ticket is invalid. Please re-enter");
   }
   else if (mode == "fqtCheck"){
     if("11111111111" == message.text){
        decideFlows(recipientId);
      }  
      else
       sendMessage(recipientId,"Your fqtv no is invalid. Please re-enter");
   }
}


function sendMessage(recipientId, message){
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
      addMenu(recipientId);
      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
        
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

function addMenu() {
    request({
    uri: 'https://graph.facebook.com/v2.6/me/thread_settings',
    qs: { access_token: "EAAEYZCvXjIksBABoD9oVmZAfguZBjnojimEtNlZBMAY2bD0OkqeaZBmGcZB62SVraANcbz4yBSGI0z2iJerTThbg6GJThZAfPb0u4X1D2O0Pi5ALzZBpjus0CLBrsYmW6pUpzLDhqhpfOdl7uoTFA9qzB1mdMBVZB0KThZAhpB3JR4gAZDZD" },
    method: 'POST',
    json: getJson('addmenu')

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
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('generic')
    
  };
  callSendAPI(messageData);
}


function sendItinerary(recipientId){
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getItinerary')
  };                
   callSendAPI(messageData);
}

function sendFlightStatus(recipientId){
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('getStatus')
  };
   callSendAPI(messageData);
}

function sendBoardingPass(recipientId){
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

function endMessage(senderid, time){
  setTimeout(function() {
          store.userConversationMap[senderid].nextExpectedAction = 'chooseIdentification';
          sendMessage(senderid,"Thanks for using Travel bot... Have a Nice trip!!!");
  }, time);
}

app.listen(process.env.PORT, function () {
  setTimeout(broadCastMessage, 5000);
  console.log('Server is up and running...');
});