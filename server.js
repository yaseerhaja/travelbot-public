//
// # SimpleServer
//
// A simple airline checkin application.
//

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = require("path");
var request = require('request');
var senderID_arr = [];

app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, 'client')));

app.get('/index',function(req,res){
  res.sendFile(__dirname+'/client/index.html');
});

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.post('/webhook', function (req, res) {
  var data = req.body;
  
  if (data.object == 'page') {
    data.entry.forEach(function(pageEntry) {
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          // Todo - receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          var message = messagingEvent.message.text;
          if(typeof message !== 'undefined' && message.substring(0,1) == "#")
            receivedIdentificationMessage(messagingEvent); 
          else
            receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          // Todo - receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    res.sendStatus(200);
  }
});

function getJson(filename){
 var contents = require(__dirname+'/client/data/'+filename+'.json');
 return contents;
}

function receivedPostback(event){
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
        sendMessage(senderID, "Mode of Identification skipped");
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
  for(var i in senderID_arr)
    sendMessage(senderID_arr[i], "Welcome to Travelbot");
    
  setTimeout(broadCastMessage, 5*60*60*1000);  
}

app.listen(process.env.PORT, function () {
  setTimeout(broadCastMessage, 5000);
  
  console.log('Example app listening on port');
});