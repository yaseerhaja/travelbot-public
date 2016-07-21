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
var modeofselection = 0;

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
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          var message = messagingEvent.message.text;
          if(typeof message !== 'undefined' && message.substring(0,1) == "#")
            receivedIdentificationMessage(messagingEvent); 
          else
            receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
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

function receivedAuthentication(event){
  
}

function receivedDeliveryConfirmation(event){
  
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
  
  var messageId = message.mid;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'image':
        //sendImageMessage(senderID);
        break;

      case 'button':
        //sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        //sendReceiptMessage(senderID);
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
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
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
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: getJson('generic')
  };  
  console.log(messageData.message);
  callSendAPI(messageData);
}


function sendItinerary(recipientId){
  var messageData = {
                  "recipient": {
                    "id": recipientId
                  },
                  "message": {
                    "attachment": {
                      "type": "template",
                      "payload": {
                        "template_type": "airline_itinerary",
                        "intro_message": "Here\'s your flight itinerary.",
                        "locale": "en_US",
                        "pnr_number": "ABCDEF",
                        "passenger_info": [
                          {
                            "name": "Farbound Smith Jr",
                            "ticket_number": "0741234567890",
                            "passenger_id": "p001"
                          },
                          {
                            "name": "Nick Jones",
                            "ticket_number": "0741234567891",
                            "passenger_id": "p002"
                          }
                        ],
                        "flight_info": [
                          {
                            "connection_id": "c001",
                            "segment_id": "s001",
                            "flight_number": "KL9123",
                            "aircraft_type": "Boeing 737",
                            "departure_airport": {
                              "airport_code": "SFO",
                              "city": "San Francisco",
                              "terminal": "T4",
                              "gate": "G8"
                            },
                            "arrival_airport": {
                              "airport_code": "SLC",
                              "city": "Salt Lake City",
                              "terminal": "T4",
                              "gate": "G8"
                            },
                            "flight_schedule": {
                              "departure_time": "2016-01-02T19:45",
                              "arrival_time": "2016-01-02T21:20"
                            },
                            "travel_class": "business"
                          },
                          {
                            "connection_id": "c002",
                            "segment_id": "s002",
                            "flight_number": "KL321",
                            "aircraft_type": "Boeing 747-200",
                            "travel_class": "business",
                            "departure_airport": {
                              "airport_code": "SLC",
                              "city": "Salt Lake City",
                              "terminal": "T1",
                              "gate": "G33"
                            },
                            "arrival_airport": {
                              "airport_code": "AMS",
                              "city": "Amsterdam",
                              "terminal": "T1",
                              "gate": "G33"
                            },
                            "flight_schedule": {
                              "departure_time": "2016-01-02T22:45",
                              "arrival_time": "2016-01-03T17:20"
                            }
                          }
                        ],
                        "passenger_segment_info": [
                          {
                            "segment_id": "s001",
                            "passenger_id": "p001",
                            "seat": "12A",
                            "seat_type": "Business"
                          },
                          {
                            "segment_id": "s001",
                            "passenger_id": "p002",
                            "seat": "12B",
                            "seat_type": "Business"
                          },
                          {
                            "segment_id": "s002",
                            "passenger_id": "p001",
                            "seat": "73A",
                            "seat_type": "World Business",
                            "product_info": [
                              {
                                "title": "Lounge",
                                "value": "Complimentary lounge access"
                              },
                              {
                                "title": "Baggage",
                                "value": "1 extra bag 50lbs"
                              }
                            ]
                          },
                          {
                            "segment_id": "s002",
                            "passenger_id": "p002",
                            "seat": "73B",
                            "seat_type": "World Business",
                            "product_info": [
                              {
                                "title": "Lounge",
                                "value": "Complimentary lounge access"
                              },
                              {
                                "title": "Baggage",
                                "value": "1 extra bag 50lbs"
                              }
                            ]
                          }
                        ],
                        "price_info": [
                          {
                            "title": "Fuel surcharge",
                            "amount": "1597",
                            "currency": "USD"
                          }
                        ],
                        "base_price": "12206",
                        "tax": "200",
                        "total_price": "14003",
                        "currency": "USD"
                      }
                    }
                  }
                };
                
   callSendAPI(messageData);
}

function sendCheckin(recipientId){
  var messageData = {
                  "recipient": {
                    "id": recipientId
                  },
                   "message": {
                      "attachment": {
                        "type": "template",
                        "payload": {
                          "template_type": "airline_checkin",
                          "intro_message": "Check-in is available now.",
                          "locale": "en_US",
                          "pnr_number": "ABCDEF",
                          "flight_info": [
                            {
                              "flight_number": "f001",
                              "departure_airport": {
                                "airport_code": "SFO",
                                "city": "San Francisco",
                                "terminal": "T4",
                                "gate": "G8"
                              },
                              "arrival_airport": {
                                "airport_code": "SEA",
                                "city": "Seattle",
                                "terminal": "T4",
                                "gate": "G8"
                              },
                              "flight_schedule": {
                                "boarding_time": "2016-01-05T15:05",
                                "departure_time": "2016-01-05T15:45",
                                "arrival_time": "2016-01-05T17:30"
                              }
                            }
                          ],
                          "checkin_url": "https:\/\/www.airline.com\/check-in"
                        }
                      }
                    }
                };
                
   callSendAPI(messageData);
}

function sendFlightStatus(recipientId){
  var messageData = {
                  "recipient": {
                    "id": recipientId
                  },
                   "message": {
                      "attachment": {
                        "type": "template",
                        "payload": {
                          "template_type": "airline_update",
                          "intro_message": "Your flight is delayed",
                          "update_type": "delay",
                          "locale": "en_US",
                          "pnr_number": "CF23G2",
                          "update_flight_info": {
                            "flight_number": "KL123",
                            "departure_airport": {
                              "airport_code": "SFO",
                              "city": "San Francisco",
                              "terminal": "T4",
                              "gate": "G8"
                            },
                            "arrival_airport": {
                              "airport_code": "AMS",
                              "city": "Amsterdam",
                              "terminal": "T4",
                              "gate": "G8"
                            },
                            "flight_schedule": {
                              "boarding_time": "2015-12-26T10:30",
                              "departure_time": "2015-12-26T11:30",
                              "arrival_time": "2015-12-27T07:30"
                            }
                          }
                        }
                      }
                    }
                };
                
   callSendAPI(messageData);
}

function sendBoardingPass(recipientId){
  var messageData = {
                  "recipient": {
                    "id": recipientId
                  },
                   "message": {
                      "attachment": {
                        "type": "template",
                        "payload": {
                          "template_type": "airline_boardingpass",
                          "intro_message": "You are checked in.",
                          "locale": "en_US",
                          "boarding_pass": [
                            {
                              "passenger_name": "SMITH\/NICOLAS",
                              "pnr_number": "CG4X7U",
                              "travel_class": "business",
                              "seat": "74J",
                              "auxiliary_fields": [
                                {
                                  "label": "Terminal",
                                  "value": "T1"
                                },
                                {
                                  "label": "Departure",
                                  "value": "30OCT 19:05"
                                }
                              ],
                              "secondary_fields": [
                                {
                                  "label": "Boarding",
                                  "value": "18:30"
                                },
                                {
                                  "label": "Gate",
                                  "value": "D57"
                                },
                                {
                                  "label": "Seat",
                                  "value": "74J"
                                },
                                {
                                  "label": "Sec.Nr.",
                                  "value": "003"
                                }
                              ],
                              "logo_image_url": "https:\/\/www.example.com\/en\/logo.png",
                              "header_image_url": "https:\/\/www.example.com\/en\/fb\/header.png",
                              "qr_code": "M1SMITH\/NICOLAS  CG4X7U nawouehgawgnapwi3jfa0wfh",
                              "above_bar_code_image_url": "https:\/\/www.example.com\/en\/PLAT.png",
                              "flight_info": {
                                "flight_number": "KL0642",
                                "departure_airport": {
                                  "airport_code": "JFK",
                                  "city": "New York",
                                  "terminal": "T1",
                                  "gate": "D57"
                                },
                                "arrival_airport": {
                                  "airport_code": "AMS",
                                  "city": "Amsterdam"
                                },
                                "flight_schedule": {
                                  "departure_time": "2016-01-02T19:05",
                                  "arrival_time": "2016-01-05T17:30"
                                }
                              }
                            },
                            {
                              "passenger_name": "JONES\/FARBOUND",
                              "pnr_number": "CG4X7U",
                              "travel_class": "business",
                              "seat": "74K",
                              "auxiliary_fields": [
                                {
                                  "label": "Terminal",
                                  "value": "T1"
                                },
                                {
                                  "label": "Departure",
                                  "value": "30OCT 19:05"
                                }
                              ],
                              "secondary_fields": [
                                {
                                  "label": "Boarding",
                                  "value": "18:30"
                                },
                                {
                                  "label": "Gate",
                                  "value": "D57"
                                },
                                {
                                  "label": "Seat",
                                  "value": "74K"
                                },
                                {
                                  "label": "Sec.Nr.",
                                  "value": "004"
                                }
                              ],
                              "logo_image_url": "https:\/\/www.example.com\/en\/logo.png",
                              "header_image_url": "https:\/\/www.example.com\/en\/fb\/header.png",
                              "qr_code": "M1JONES\/FARBOUND  CG4X7U nawouehgawgnapwi3jfa0wfh",
                              "above_bar_code_image_url": "https:\/\/www.example.com\/en\/PLAT.png",
                              "flight_info": {
                                "flight_number": "KL0642",
                                "departure_airport": {
                                  "airport_code": "JFK",
                                  "city": "New York",
                                  "terminal": "T1",
                                  "gate": "D57"
                                },
                                "arrival_airport": {
                                  "airport_code": "AMS",
                                  "city": "Amsterdam"
                                },
                                "flight_schedule": {
                                  "departure_time": "2016-01-02T19:05",
                                  "arrival_time": "2016-01-05T17:30"
                                }
                              }
                            }
                          ]
                        }
                      }
                    }
                };
                
   callSendAPI(messageData);
}
app.listen(process.env.PORT, function () {
  console.log('Example app listening on port');
});