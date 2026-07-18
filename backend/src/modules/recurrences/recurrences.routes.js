const { Router } = require("express");
const { z } = require("zod");

const controller = require("./recurrences.controller");
const validate = require("../../middlewares/validate.middleware");

const idParam = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido."),
  }),
});

const router = Router();

router.get("/", controller.list);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
