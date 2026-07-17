const { wirePersonalizationEvents } = require("./events/handlers");
const service = require("./personalization.service");
const engine = require("./engine/PersonalizationEngine");
const { EVENTS } = require("./constants");

wirePersonalizationEvents();

module.exports = {
  service,
  engine,
  EVENTS,
  notifyMutation: service.notifyMutation,
};
