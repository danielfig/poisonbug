(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  }
  if (typeof root !== 'undefined') {
    root.POISONBUG_STARTER_CARDS = data;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Store starts empty — only cards actually listed by the owner appear for sale!
  return [];
});
