const Base = require("../base");

class Index extends Base{
  constructor(router) {
    super(router, "index");
  }

  routers() {
    this.get("/", this.index.bind(this));
  }

  async index(ctx) {
    await this.render(ctx, "index", { current: "index" });
  }
}

module.exports = Index;
