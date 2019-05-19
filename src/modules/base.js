const path = require("path");

class Base {
  constructor(router, modulo) {
    this.router = router;
    this.modulo = modulo;
  }

  get(path, fn) {
    this.router.get(path, fn);
  }

  post(path, fn) {
    this.router.post(path, fn);
  }

  render(ctx, template, params) {
    return ctx.render(`modules/${this.modulo}/${template}`, params);
  }
}

module.exports = Base;
