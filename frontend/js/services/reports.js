import { bffService } from "./bff.js";

/** @deprecated Prefira bffService.getReports() */
export const reportsService = {
  list: (params = {}) => bffService.getReports(params),
};
