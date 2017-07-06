require("dotenv").configure();
var express = require("express");
var request = require("request"); //node module used for making http calls
var bodyParser = require("body-parser");
const fetch = require("node-fetch");

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use((req, res, next) => {
  console.log(req.path);
  next();
});
app.use(bodyParser.json());
const port = process.env.PORT || 5000;
app.listen(port, error => {
  if (error) {
    console.err("Failed to start", error);
  } else {
    console.log("application started listening on", port);
  }
});

// Server index page
app.get("/", function(req, res) {
  res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function(req, res) {
  if (req.query["hub.verify_token"] === "this_is_my_token") {
    console.log("Verified webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Verification failed. The tokens do not match.");
    res.sendStatus(403);
  }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function(req, res) {
  console.log("POST /webhook body: ", body);
  // Make sure this is a page subscription
  if (req.body.object == "page") {
    // Iterate over each entry
    // There may be multiple entries if batched
    req.body.entry.forEach(function(entry) {
      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.postback) {
          processPostback(event);
        } else if (event.message) {
          processMessage(event);
        }
      });
    });

    res.sendStatus(200);
  }
});

function processPostback(event) {
  var senderId = event.sender.id;
  var payload = event.postback.payload;

  if (payload === "Greeting") {
    // Get user's first name from the User Profile API
    // and include it in the greeting
    request(
      {
        url: "https://graph.facebook.com/v2.6/" + senderId,
        qs: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
          fields: "first_name"
        },
        method: "GET"
      },
      function(error, response, body) {
        var greeting = "";
        if (error) {
          console.log("Error getting user's name: " + error);
        } else {
          var bodyObj = JSON.parse(body);
          name = bodyObj.first_name;
          greeting = "Hi " + name + ". ";
        }
        var message =
          greeting +
          "My name is SP Movie Bot. I can tell you various details regarding movies. What movie would you like to know about?";
        sendMessage(senderId, { text: message });
      }
    );
  } else if (payload === "Correct") {
    sendMessage(senderId, {
      text: "Awesome! What would you like to find out? Enter 'plot', 'date', 'runtime', 'director', 'cast' or 'rating' for the various details."
    });
  } else if (payload === "Incorrect") {
    sendMessage(senderId, {
      text: "Oops! Sorry about that. Try using the exact title of the movie"
    });
  }
}

function processMessage(event) {
  if (!event.message.is_echo) {
    var message = event.message;
    var senderId = event.sender.id;

    console.log("Received message from senderId: " + senderId);
    console.log("Message is: " + JSON.stringify(message));

    // You may get a text or attachment but not both
    if (message.text) {
      var formattedMsg = message.text.toLowerCase().trim();

      if (formattedMsg.startsWith("org:")) {
        const org = formattedMsg.slice("org:".length).trim();
      }
    } else if (message.attachments) {
      sendMessage(senderId, {
        text: "Sorry, I don't understand your request."
      });
    }
  }
}

function readOrganisationMembers(org, recipientId) {
  fetch(`https://api.github.com/orgs/${org}/members`)
    .then(res => {
      if (!res.ok) {
        throw new Error("bad response from GitHub");
      } else {
        return res.json();
      }
    })
    .then(body => {
      const message = body.map(user => user.login).join(", ");
      sendMessage(recipientId, message);
    })
    .catch(error => {
      console.error("Failed to talk to GitHub" + error);
    });
}

// sends message to user
function sendMessage(recipientId, message) {
  request(
    {
      url: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: {
        recipient: { id: recipientId },
        message: message
      }
    },
    function(error, response, body) {
      if (error) {
        console.log("Error sending message: " + response.error);
      }
    }
  );
}
