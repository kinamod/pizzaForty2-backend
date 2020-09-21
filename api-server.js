require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");

const app = express();

const port = process.env.PORT;
const appOrigin = process.env.APP_ORIGIN; 
const audience = process.env.AUTH0_AUDIENCE;
const issuer = process.env.AUTH0_ISSUER;

if (!issuer || !audience) {
  
  throw new Error("Please make sure that .env is in place and populated: "+issuer);
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
  res.send({
    msg: "The API doesn't require an access token to share this message.",
  });
});

app.get("/api/authorize", checkJwt, (req, res) => {
	
  res.send({
    msg: "authorizing.",
  });
});

app.get("/api/order-pizza", checkJwt, (req, res) => {
  res.send({
    msg: "We have added this pizza order!",
  });
});

app.listen(port, () => console.log(`API Server listening on port ${port}`));
