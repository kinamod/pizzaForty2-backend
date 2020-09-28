require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const axios = require('axios');
const qs = require('qs');
const { response } = require("express");


const port = process.env.PORT;
const appOrigin = process.env.APP_ORIGIN.split(",");
const audience = process.env.AUTH0_AUDIENCE;
const issuer = process.env.AUTH0_ISSUER;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;
const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;
const runningLocally = process.env.RUNNING_LOCALLY;

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
  testLogging(req.get("user_data"));
  testLogging(req.headers);
  res.send({
    msg: "The API doesn't require an access token to share this message. I'll talk to anyone if you're able to click this button!",
  });
});

app.get("/api/verify-email", checkJwt, (req, res) => {
  verifyEmail(req);
  res.send({
    msg: "We've sent you a verification email",
  });
});

app.get("/api/get-full-id", checkJwt, (req, res) => {
  getFullAuth0ID(req, res)
    .then(function (response) {
      testLogging("get fullid:\n" + JSON.stringify(response.data));
      res.send(response.data);
    })
    .catch(function (error) {
      testLogging(error);
      return error;
    });
  //return res;
});


app.get("/api/order-pizza", checkJwt, (req, res) => {
  res.send({
    pizzaStatus: true,
    msg: "your pizza is on its way!"
  });
});

app.listen(port, () => testLogging(`API Server listening on port ${port}`));


//Helper functions
async function getManagamentApiToken() {
  try {
    const data = qs.stringify({
      'grant_type': 'client_credentials',
      'client_id': auth0ClientId,
      'client_secret': auth0ClientSecret,
      'audience': `${issuer}api/v2/`  //This is the issuer because this is the audience as far as GOOGLE is concerned
    });

    const config = {
      method: 'post',
      url: `${issuer}oauth/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: data,
    };

    const bearerToken = await axios(config);
    return bearerToken.data.access_token;
  } catch (e) {
    testLogging(e);
  }
}

async function verifyEmail(req) {
  try {
    testLogging(req.get("UserID"));
    testLogging(req.headers);

    const bearerToken = await getManagamentApiToken();
    // const bearerToken = responseToken.data.access_token
    testLogging("verify email - api token:\n\n" + bearerToken)

    if (bearerToken) {


      const data = qs.stringify({
        'user_id': req.get("UserID")//'auth0|5f6e42e04dbd480076764b8e'//TODO DSJ
      });

      const config = {
        method: 'post',
        url: `${issuer}api/v2/jobs/verification-email`,
        headers: {
          'Authorization': 'Bearer ' + bearerToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: data,
      };

      const response = await axios(config);
      // testLogging(response.json);
      return response;
    }
  } catch (e) {
    testLogging(e)
  }

  return response.write({ msg: "didnt work", });

}

function testLogging(message) {
  if (runningLocally) console.log(message);
}

async function getFullAuth0ID(req, response) {
  const url = `${issuer}api/v2/users/` + req.get("UserID");
  testLogging("get full id - url: " + url);

  try {
    //getting token to call auth0
    const bearerToken = await getManagamentApiToken();

    //using auth0 token to get the token auth0 has for googleAPI
    testLogging("api token: " + bearerToken)
    const config = {
      url: url,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + bearerToken,
      }
    };

    response = await axios(config);
    testLogging("getFullAuth0ID: response data: " + response.data);
    return response;

  } catch (err) {
    testLogging("getFullAuth0ID: " + err)
  }
}

//TESTING methids
// async function getFullIdandTesting(req, res) {
//   // testLogging(req);

//   var url = "https://dev-kinamod-01.eu.auth0.com/api/v2/users/" + req.get("UserID");
//   testLogging("get full id - url: " + url);
//   ///TEMPLATE

//   var token;
//   var googleUserID;
//   try {
//     //getting token to call auth0
//     const bearerToken = await getManagamentApiToken();

//     //using auth0 token to get the token auth0 has for googleAPI
//     testLogging("api token: " + bearerToken)
//     const config = {
//       url: url,
//       method: 'GET',
//       headers: {
//         'Authorization': 'Bearer ' + bearerToken,
//       }
//     };

//     const response = await axios(config);
//     testLogging(response.data);

//     //go through the json to extract the token
//     response.data.identities.forEach(function (identity) {
//       testLogging("provider: " + identity.provider);
//       if (identity.provider == "google-oauth2") {
//         token = identity.access_token;
//         googleUserID = identity.user_id;
//         testLogging("token: " + token);

//       }
//     });

//     //use token from google profile call
//     const googleCallConfig = {
//       method: 'get',
//       url: 'https://content-people.googleapis.com/v1/people/' + googleUserID + '?personFields=genders',
//       headers: {
//         'Authorization': 'Bearer ' + token
//       }
//     };

//     axios(googleCallConfig)
//       .then(function (response) {
//         testLogging("This is the person back from google" + JSON.stringify(response.data));
//         testLogging("gender is: " + response.data.genders[0].value)
//       })
//       .catch(function (error) {
//         testLogging(error);
//       });

//     //START getting google contact list

//     connectionListConfig = {
//       method: 'get',
//       url: 'https://content-people.googleapis.com/v1/people/me/connections?personFields=names',
//       headers: {
//         'Authorization': 'Bearer ' + token
//       }
//     };

//     axios(connectionListConfig)
//       .then(function (response) {
//         testLogging("connection list\n" + response.data.totalPeople);
//       })
//       .catch(function (error) {
//         testLogging(error);
//       });


//     //END getting google contact list


//     res.send("Full ID Method is complete");
//   } catch (err) {
//     console.error(err);
//   }
// }