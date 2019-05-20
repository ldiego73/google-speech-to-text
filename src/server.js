const http = require("http");
const https = require("https");
const Koa = require("koa");
const Router = require("koa-router");
const koaBody = require("koa-body");
const Render = require("koa-ejs");
const path = require("path");
const fs = require("fs");

const Index = require("./modules/index");
const Speech = require("./modules/speech/speech");

const options = {
  key: fs.readFileSync("./localhost-privkey.pem"),
  cert: fs.readFileSync("./localhost-cert.pem")
};

const PORT = 80;
const PORT_SSL = 8080;
const app = new Koa();
const server1 = http.createServer(app.callback());
const server2 = https.createServer(options, app.callback());
const router = new Router();

Render(app, {
  root: path.join(__dirname, "./"),
  layout: "layouts/master",
  viewExt: "html",
  cache: false,
  debug: false
});

const index = new Index(router);
const speech = new Speech(router, server1);

index.routers();
speech.routers();

app.use(koaBody({ multipart: true, json: true, maxFileSize: 100 * 1024 * 1024 }));
app.use(router.routes());
app.use(router.allowedMethods());

server1.listen(PORT, err => {
  if (err) throw err;

  console.log(`Listening on port: ${PORT}`);
});

server2.listen(PORT_SSL, err => {
  if (err) throw err;

  console.log(`Listening on port: ${PORT_SSL}`);
});
