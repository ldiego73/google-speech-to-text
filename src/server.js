const http = require("http");
const Koa = require("koa");
const Router = require("koa-router");
const koaBody = require("koa-body");
const Render = require("koa-ejs");
const path = require("path");

const Index = require("./modules/index");
const Speech = require("./modules/speech/speech");

const PORT = 80;
const app = new Koa();
const server = http.createServer(app.callback());
const router = new Router();

Render(app, {
  root: path.join(__dirname, "./"),
  layout: "layouts/master",
  viewExt: "html",
  cache: false,
  debug: false
});

const index = new Index(router);
const speech = new Speech(router, server);

index.routers();
speech.routers();

app.use(koaBody({ multipart: true, json: true, maxFileSize: 50 * 1024 * 1024 }));
app.use(router.routes());
app.use(router.allowedMethods());

server.listen(PORT, err => {
  if (err) throw err;

  console.log(`Listening on port: ${PORT}`);
});
