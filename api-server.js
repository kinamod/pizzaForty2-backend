require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const axios = require('axios');
const { google } = require('googleapis');
//extra stuff for this authenticate methid
const http = require('http');
const opn = require('open');
const destroyer = require('server-destroy');


const port = process.env.PORT;
const appOrigin = process.env.APP_ORIGIN.split(",");
const audience = process.env.AUTH0_AUDIENCE;
const issuer = process.env.AUTH0_ISSUER;
const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;
const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;

if (!issuer || !audience) {

  throw new Error("Please make sure that .env is in place and populated: " + issuer);
}

app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: appOrigin }));

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${issuer}.well-known/jwks.json`,
  }),

  audience: audience,
  issuer: issuer,
  algorithms: ["RS256"],
});

app.get("/api/public-message", (req, res) => {
  console.log(req.get("user_data"));
  console.log(req.headers);
  res.send({
    msg: "The API doesn't require an access token to share this message. I'll talk to anyone if you're able to click this button!",
  });
});

app.get("/api/get-full-id", checkJwt, (req, res) => {
  getFullId(req, res);
});
async function getFullId(req, res) {
  // console.log(req);

  var url = "https://dev-kinamod-01.eu.auth0.com/api/v2/users/" + req.get("UserID");
  console.log("get full id - url: " + url);
  ///TEMPLATE

  var token;
  try {
    const bearerToken = await getManagamentApiToken();
    console.log("api token: " + bearerToken)
    const config = {
      url: url,
      method: 'GET',
      headers: {
        'Authorization': bearerToken,
      }
    };

    const response = await axios(config);
    console.log(response.data);

    response.data.identities.forEach(function (identity) {
      console.log("provider: " + identity.provider);
      if (identity.provider == "google-oauth2") {
        token = identity.access_token;
        console.log("token: " + token);

      }
    });

    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, req.get("RedirectUrl"));
    const tokenInJSON = JSON.parse(`{"token":"` + token + `"}`);
    oAuth2Client.setCredentials(tokenInJSON);

    authenticate(['https://www.googleapis.com/auth/contacts.readonly'], oAuth2Client).then(returnedClient => listConnectionNames(returnedClient));
    console.log("oAuth2Client: " + oAuth2Client);

    res.send(tokenInJSON);
  } catch (err) {
    console.error(err);
  }
}

app.get("/api/order-pizza", checkJwt, (req, res) => {
  res.send({
    msg: "We have added this pizza order!",
  });
});

app.listen(port, () => console.log(`API Server listening on port ${port}`));


//LOCAL FUNCTION SECTION
/**
 * Print the display name if available for 10 connections.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listConnectionNames(auth) {
  console.log("listName entered: " + auth);
  const service = google.people({ version: 'v1', auth });
  service.people.connections.list({
    resourceName: 'people/me',
    pageSize: 10,
    personFields: 'names,emailAddresses',
  }, (err, res) => {
    if (err) return console.error('The API returned an error: ' + err);
    const connections = res.data.connections;
    if (connections) {
      console.log('Connections:');
      connections.forEach((person) => {
        if (person.names && person.names.length > 0) {
          console.log(person.names[0].displayName);
        } else {
          console.log('No display name found for connection.');
        }
      });
    } else {
      console.log('No connections found.');
    }
  });
}

async function authenticate(scopes, oauth2Client) {
  return new Promise((resolve, reject) => {
    // grab the url that will be used for authorization
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' '),
    });
    const server = http
      .createServer(async (req, res) => {
        try {
          console.log("oauth2Client creating server");
          if (req.url.indexOf('/oauth2callback') > -1) {
            const qs = new url.URL(req.url, 'http://localhost:3004')
              .searchParams;
            res.end('Authentication successful! Please return to the console.');
            server.destroy();
            const { tokens } = await oauth2Client.getToken(qs.get('code'));
            oauth2Client.credentials = tokens; // eslint-disable-line require-atomic-updates
            console.log("oauth2Client" + oauth2Client);
            resolve(oauth2Client);

          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3004, () => {
        // open the browser to the authorize url to start the workflow
        console.log("this is the authorise url: " + authorizeUrl);
        opn(authorizeUrl, { wait: false, app: 'chrome' }).then(cp => cp.unref());
      });
    destroyer(server);
  });


  async function getManagamentApiToken() {
    const getManApiUrl = `${issuer}oauth/token`;
    try {
      var config = {
        // url: `${issuer}oauth/token`,
        // method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"client_id":"ja3oa2KjiLImIA1sDOFjzR9k69naCAf2","client_secret":"rhYtg35LCYJztd3RGoKQA7HySckfOTRtMhv90cnBDszJBEdMM8B6uRp3qKGZEDg0","audience":"https://dev-kinamod-01.eu.auth0.com/api/v2/","grant_type":"client_credentials"}'
      };
      console.log("before post")
      const managementTokenResponse = await axios.post(getManApiUrl, config)
        .then(res => console.log("res: " + res))
        .catch(err => console.log("err: " + err));

      console.log("after post")
      const manToken = await managementTokenResponse.json();
      console.log("man token: " + manToken);
      return managementToken;
    } catch (e) {
      console.error("error in getManAPI\n" + e);
    }
  }
}