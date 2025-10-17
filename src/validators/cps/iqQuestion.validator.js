// src/validators/cps/iqQuestion.validator.js
import { body } from "express-validator";

export const createUpdateValidators = [
  body("questionText").isString().isLength({ min: 10 }),
  body("dimension").optional({ nullable: true }).isString(),
  body("isActive").optional().isBoolean(),

  body("difficultyIndex").optional({ nullable: true }).isFloat({ min: 0, max: 1 }),
  body("discriminationIndex").optional({ nullable: true }).isFloat({ min: -1, max: 1 }),
  body("estimatedItemLoad").optional({ nullable: true }).isFloat({ min: 0, max: 1 }),
  body("isTimed").optional().isBoolean(),
  body("timeLimitSeconds").optional({ nullable: true }).isInt({ min: 0 }),
  body("cognitiveSkillTags").optional().isArray(),
  body("levelOfDifficulty").optional({ nullable: true }).isIn(["Easy", "Medium", "Hard", "Expert", null]),
  body("hintText").optional({ nullable: true }).isString(),

  body("choices").isArray({ min: 4, max: 4 }),
  body("choices.*.text").isString().notEmpty(),
  body("choices.*.isCorrect").isBoolean(),
  body("choices.*.distractorEfficiency").optional({ nullable: true }).isFloat({ min: 0, max: 1 }),
  body("choices.*.rubrics").isArray(),
  body("choices.*.rubrics.*.parameter").optional({ nullable: true }).isString(),
  body("choices.*.rubrics.*.value").isInt({ min: 0, max: 100 }),
];
